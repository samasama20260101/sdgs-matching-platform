// 災害SOS案件のニーズ分類(サーバー専用)。
// 登録APIの応答後(after)と夜間cronの2経路から呼ばれる。
// 原則: 失敗しても案件には一切影響しない(公開済みのまま・タグなしになるだけ)。
import 'server-only'

import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabaseAdmin } from '@/lib/supabase/server'
import { DISASTER_NEEDS, DISASTER_NEED_KEYS, MAX_DISASTER_NEEDS, type DisasterNeedKey } from '@/lib/constants/disaster'

const GEMINI_MODEL = 'gemini-2.5-flash'

function buildPrompt(text: string) {
  const categories = DISASTER_NEED_KEYS
    .map((key) => `- ${key}: ${DISASTER_NEEDS[key].labelJa}`)
    .join('\n')
  return `あなたは災害支援のコーディネーターです。以下は災害で被災した方からの相談内容です。
支援団体が対応すべきニーズを、次の8カテゴリから最大${MAX_DISASTER_NEEDS}つ選んでください。

カテゴリ(キー: 意味):
${categories}

カテゴリの目安:
- housing: 自宅損壊、避難所生活、仮住まい探し
- water_food: 断水、飲み水や食料の不足
- supplies: 衣類、毛布、衛生用品、ミルク・おむつなどの物資
- health: けが、持病、薬、通院、要介護者のケア
- mental: 不安、眠れない、話を聞いてほしい
- family: 育児、子どもの学校、高齢の家族の世話
- money_admin: 罹災証明、支援金、保険、仕事や収入の不安
- lifeline_info: 停電、通信、移動手段、情報が届かない

ルール:
- 相談文から明確に読み取れるニーズだけを選ぶこと。推測で無理に付けない
- 該当がなければ空配列にする
- 関連が強い順に最大${MAX_DISASTER_NEEDS}つ
- 出力はJSONのみ。説明文は不要: {"tags": ["water_food", "housing"]}

相談内容:
"""
${text}
"""`
}

// 相談文をニーズタグに分類する。失敗時は null(呼び出し側は何もしない)。
export async function classifyDisasterNeedsText(text: string): Promise<DisasterNeedKey[] | null> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || ''
  if (!apiKey || !text.trim()) return null

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    // 注意: gemini-2.5-flash は内部思考にも出力トークンを消費するため、
    // maxOutputTokens が小さいとJSONが途中で切れる(実測済み)。余裕を持たせること。
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
      },
    })
    const result = await model.generateContent(buildPrompt(text))
    const raw = result.response.text().replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(raw) as { tags?: unknown }
    if (!Array.isArray(parsed.tags)) return null
    return parsed.tags
      .filter((tag): tag is DisasterNeedKey => typeof tag === 'string' && tag in DISASTER_NEEDS)
      .slice(0, MAX_DISASTER_NEEDS)
  } catch (error) {
    console.error('[disasterNeeds] classify error:', error)
    return null
  }
}

// 案件1件を分類してintake_qnaへ保存する。冪等(分類済みならスキップ)。
export async function classifyDisasterNeedsForCase(caseId: string): Promise<boolean> {
  const { data: caseData, error } = await supabaseAdmin
    .from('cases')
    .select('id, description_free, intake_qna')
    .eq('id', caseId)
    .maybeSingle()
  if (error || !caseData) {
    if (error) console.error('[disasterNeeds] case fetch error:', error)
    return false
  }

  const intake = caseData.intake_qna as { disaster?: { needs?: unknown } } | null
  if (!intake?.disaster) return false        // 災害案件以外は対象外
  if (intake.disaster.needs) return true      // 分類済み(冪等)

  const tags = await classifyDisasterNeedsText(caseData.description_free || '')
  if (tags === null) return false             // 失敗: cronが後で拾い直す

  const nextIntake = {
    ...intake,
    disaster: {
      ...intake.disaster,
      needs: { tags, classified_at: new Date().toISOString() },
    },
  }
  const { error: updateError } = await supabaseAdmin
    .from('cases')
    .update({ intake_qna: nextIntake })
    .eq('id', caseData.id)
  if (updateError) {
    console.error('[disasterNeeds] save error:', updateError)
    return false
  }
  return true
}

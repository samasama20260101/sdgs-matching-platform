import 'server-only'

// AI を呼ぶ唯一の入口。提供元(Gemini・OpenAI・xAI)は src/lib/ai/config.ts が環境変数から決める。
// ここは文を渡して JSON の文字列を受け取るだけで、相談文の個人情報を伏せる(maskPii)・囲む(fenceConsultation)のは
// プロンプトを組む側の責任。AI にはツールも DB の権限も渡さない。
import { resolveAiTarget, type AiTarget, type AiTask } from '@/lib/ai/config'
import { parseJsonObject } from '@/lib/ai/json'

// 既定の待ち時間。応答のあとに動く処理(after)は Workers では 30 秒で打ち切られるので、そこで呼ぶものは短く渡す
const TIMEOUT_MS = 45_000

export type GenerateJsonOptions = {
  temperature?: number
  // 待つ時間の上限(ミリ秒)。書いていなければ 45 秒
  timeoutMs?: number
  // Gemini 2.5 は内部の思考も出力の枠を使うので、JSON が切れないよう大きめにする(実測 1,400〜3,700)
  maxOutputTokens?: number
}

export type GenerateJsonResult =
  | { ok: true; json: Record<string, unknown>; provider: AiTarget['provider']; model: string }
  | { ok: false; code: 'NOT_CONFIGURED' | 'REQUEST_FAILED' | 'INVALID_JSON' }

export function isAiConfigured(task: AiTask): boolean {
  return resolveAiTarget(task, process.env) !== null
}

export async function generateJson(task: AiTask, prompt: string, options: GenerateJsonOptions = {}): Promise<GenerateJsonResult> {
  const target = resolveAiTarget(task, process.env)
  if (!target) return { ok: false, code: 'NOT_CONFIGURED' }

  let text: string
  try {
    text = target.provider === 'gemini'
      ? await callGemini(target, prompt, options)
      : await callOpenAiCompatible(target, prompt, options)
  } catch (error) {
    console.error(`[ai] ${task} ${target.provider} request failed:`, error instanceof Error ? error.message : error)
    return { ok: false, code: 'REQUEST_FAILED' }
  }

  const json = parseJsonObject(text)
  if (!json) {
    console.error(`[ai] ${task} ${target.provider} returned non-JSON (${text.length} chars)`)
    return { ok: false, code: 'INVALID_JSON' }
  }
  return { ok: true, json, provider: target.provider, model: target.model }
}

async function callGemini(target: AiTarget, prompt: string, options: GenerateJsonOptions): Promise<string> {
  const url = `${target.baseUrl}/models/${encodeURIComponent(target.model)}:generateContent`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': target.apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: options.temperature ?? 0.1,
        maxOutputTokens: options.maxOutputTokens ?? 8192,
        responseMimeType: 'application/json',
      },
    }),
    signal: AbortSignal.timeout(options.timeoutMs ?? TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const data = (await response.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
  return (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('')
}

// OpenAI と xAI(Grok)は同じ形の Chat Completions API。
// 推論型のモデルは temperature の指定を断ることがあるので送らない。出力の上限も各社の既定に任せる。
// 考える量は環境変数で決めたときだけ送る(src/lib/ai/config.ts)。
async function callOpenAiCompatible(target: AiTarget, prompt: string, options: GenerateJsonOptions): Promise<string> {
  const response = await fetch(`${target.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${target.apiKey}` },
    body: JSON.stringify({
      model: target.model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      ...(target.reasoningEffort ? { reasoning_effort: target.reasoningEffort } : {}),
    }),
    signal: AbortSignal.timeout(options.timeoutMs ?? TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const data = (await response.json()) as { choices?: { message?: { content?: string | null } }[] }
  return data.choices?.[0]?.message?.content ?? ''
}

// lib/gemini.ts
// Google Gemini API統合ライブラリ

import { GoogleGenerativeAI } from '@google/generative-ai';

// APIキーの取得（両方の変数名に対応）
const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error('GOOGLE_GEMINI_API_KEY is not defined in environment variables');
}

// Gemini AIインスタンスの初期化
const genAI = new GoogleGenerativeAI(apiKey);

/**
 * 相談内容からSDGsゴールを分類する
 * @param consultationText ユーザーの相談内容
 * @returns SDGsゴール番号の配列と理由
 */
export async function classifySDGs(consultationText: string) {
  try {
    // Gemini 1.5 Flash Latest モデルを使用
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
あなたはSDGs（持続可能な開発目標）の専門家です。
以下の相談内容を分析し、関連するSDGsゴール（1-17）を最大3つまで選択してください。

相談内容：
${consultationText}

以下のJSON形式で回答してください：
{
  "sdgs_goals": [ゴール番号の配列],
  "reasoning": "分類理由の説明",
  "keywords": ["抽出されたキーワード"]
}

SDGsゴール一覧：
1. 貧困をなくそう
2. 飢餓をゼロに
3. すべての人に健康と福祉を
4. 質の高い教育をみんなに
5. ジェンダー平等を実現しよう
6. 安全な水とトイレを世界中に
7. エネルギーをみんなに そしてクリーンに
8. 働きがいも経済成長も
9. 産業と技術革新の基盤をつくろう
10. 人や国の不平等をなくそう
11. 住み続けられるまちづくりを
12. つくる責任 つかう責任
13. 気候変動に具体的な対策を
14. 海の豊かさを守ろう
15. 陸の豊かさも守ろう
16. 平和と公正をすべての人に
17. パートナーシップで目標を達成しよう
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // JSONレスポンスをパース
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        success: true,
        data: parsed,
      };
    }

    throw new Error('Invalid response format from Gemini API');
  } catch (error) {
    console.error('Gemini API Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 相談内容に対する質問を生成する
 * @param consultationText ユーザーの相談内容
 * @returns 追加質問の配列
 */
export async function generateFollowUpQuestions(consultationText: string) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
以下の相談内容に対して、より詳しい情報を得るための質問を3つ生成してください。
質問は具体的で、回答者が答えやすいものにしてください。

相談内容：
${consultationText}

以下のJSON形式で回答してください：
{
  "questions": ["質問1", "質問2", "質問3"]
}
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        success: true,
        data: parsed.questions,
      };
    }

    throw new Error('Invalid response format from Gemini API');
  } catch (error) {
    console.error('Gemini API Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * NPOとのマッチング度を計算
 * @param consultationText ユーザーの相談内容
 * @param npoDescription NPOの活動内容
 * @returns マッチング度（0-100）と理由
 */
export async function calculateMatchingScore(
  consultationText: string,
  npoDescription: string
) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
以下の相談内容とNPOの活動内容を分析し、マッチング度を0-100のスコアで評価してください。

相談内容：
${consultationText}

NPO活動内容：
${npoDescription}

以下のJSON形式で回答してください：
{
  "score": マッチング度（0-100の整数）,
  "reasoning": "スコアの理由",
  "strengths": ["マッチングの強み1", "強み2"],
  "considerations": ["検討すべき点1", "検討点2"]
}
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        success: true,
        data: parsed,
      };
    }

    throw new Error('Invalid response format from Gemini API');
  } catch (error) {
    console.error('Gemini API Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
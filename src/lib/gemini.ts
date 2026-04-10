// lib/gemini.ts
// Google Gemini API統合ライブラリ

import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * 相談内容からSDGsゴールを分類する
 * @param consultationText ユーザーの相談内容
 * @returns SDGsゴール番号の配列と理由
 */
export async function classifySDGs(consultationText: string) {
  // APIキーの取得（実行時に取得）
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';

  // デモモードの場合
  if (!apiKey) {
    return {
      success: true,
      data: {
        sdgs_goals: [4, 1, 10],
        summary: "あなたが学びの機会を求めていること、経済的に厳しい状況にあること、そして不平等な扱いを受けていることが伝わりました。これらは世界中で多くの人が直面している課題であり、あなたは一人ではありません。",
        per_goal: [
          { goal: 4, title: "あなたの「学びたい」という気持ちは大切な権利です", explanation: "教育を受ける機会は、すべての人に保障されるべき基本的な権利です。あなたが感じている困難は、SDGsでも最も重要な課題の一つとして世界中で取り組まれています。" },
          { goal: 1, title: "経済的な困難は、あなたのせいではありません", explanation: "生活に必要な資源が不足している状況は、社会の仕組みに原因があることが多いです。支援制度や相談窓口を通じて、状況を改善できる可能性があります。" },
          { goal: 10, title: "誰もが公平に扱われる社会をめざして", explanation: "差別や不平等な扱いを受けることは、あってはならないことです。あなたの声を届けることが、より公正な社会への第一歩になります。" }
        ],
        reasoning: "【デモモード】実際のAI分析にはGoogle Gemini APIキーの設定が必要です。",
        keywords: ["デモモード", "APIキー未設定", "テスト"]
      }
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
あなたはSDGs（持続可能な開発目標）の専門家であり、困っている人に寄り添うカウンセラーでもあります。
以下の相談内容を分析し、関連するSDGsゴール（1-17）を最大3つまで選択してください。

重要：相談者は困難な状況にいる一般の方です。専門用語を避け、温かく共感的な言葉で説明してください。
「あなたの問題は世界でも大切にされている課題です」というメッセージを伝えてください。

【重要ルール】
- 相談内容がすべて「該当なし」の場合、または情報が少なすぎてSDGsゴールを特定できない場合は、
  必ず sdgs_goals を空配列 [] にしてください。無理に分類しないでください。
- 自由記述が1〜2文字程度で意味のある内容が読み取れない場合も、sdgs_goals を [] にしてください。
- 「該当なし」の選択が多く、実質的な困りごとが読み取れない場合も、sdgs_goals を [] にしてください。
- 不明・不十分な場合は分類しないことが正しい判断です。

相談内容：
${consultationText}

以下のJSON形式で回答してください：
{
  "sdgs_goals": [ゴール番号の配列（最大3つ、情報不足の場合は空配列[]）],
  "summary": "全体の要約（2〜3文。sdgs_goalsが空の場合は「もう少し詳しく教えてもらえると、より適切な支援者につなぐことができます」のようなメッセージ）",
  "per_goal": [
    {
      "goal": ゴール番号,
      "title": "相談者に寄り添う短いタイトル（例：あなたの健康を守る権利があります）",
      "explanation": "このゴールと相談内容の関連を、相談者にわかりやすく、温かい言葉で説明（3〜4文）"
    }
  ],
  "keywords": ["相談内容から抽出したキーワード（5〜8個）。情報不足の場合は空配列[]"]
}

注意：
- per_goalはsdgs_goalsと同じ順番で、各ゴールに対して1つずつ（空の場合はper_goalも[]）
- titleは相談者目線で、「〜する権利があります」「〜はあなたのせいではありません」のような温かい表現で
- explanationは専門用語を使わず、やさしい日本語で
- reasoningフィールドは不要です

SDGsゴール一覧：
1. 貧困をなくそう  2. 飢餓をゼロに  3. すべての人に健康と福祉を
4. 質の高い教育をみんなに  5. ジェンダー平等を実現しよう
6. 安全な水とトイレを世界中に  7. エネルギーをみんなにそしてクリーンに
8. 働きがいも経済成長も  9. 産業と技術革新の基盤をつくろう
10. 人や国の不平等をなくそう  11. 住み続けられるまちづくりを
12. つくる責任つかう責任  13. 気候変動に具体的な対策を
14. 海の豊かさを守ろう  15. 陸の豊かさも守ろう
16. 平和と公正をすべての人に  17. パートナーシップで目標を達成しよう
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

/**
 * 相談内容に対する質問を生成する
 * @param consultationText ユーザーの相談内容
 * @returns 追加質問の配列
 */
export async function generateFollowUpQuestions(consultationText: string) {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';

  if (!apiKey) {
    return {
      success: true,
      data: [
        "【デモモード】質問1のサンプル",
        "【デモモード】質問2のサンプル",
        "【デモモード】質問3のサンプル"
      ]
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
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
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';

  if (!apiKey) {
    return {
      success: true,
      data: {
        score: 85,
        reasoning: "【デモモード】これはデモ応答です。",
        strengths: ["デモ強み1", "デモ強み2"],
        considerations: ["デモ検討点1", "デモ検討点2"]
      }
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
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
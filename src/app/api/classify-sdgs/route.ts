// app/api/classify-sdgs/route.ts
// SDGsゴール分類APIエンドポイント

import { NextRequest, NextResponse } from 'next/server';
import { requireActiveAppUser } from '@/lib/api/auth';
import { classifySDGs } from '@/lib/gemini';

const MAX_CONSULTATION_TEXT_LENGTH = 5000;

export async function POST(request: NextRequest) {
  try {
    const auth = await requireActiveAppUser(request, { roles: ['ADMIN'] });
    if ('response' in auth) return auth.response;

    const body = await request.json();
    const { consultationText } = body;

    // バリデーション
    if (!consultationText || typeof consultationText !== 'string') {
      return NextResponse.json(
        { error: '相談内容が必要です' },
        { status: 400 }
      );
    }

    if (consultationText.length < 10) {
      return NextResponse.json(
        { error: '相談内容は10文字以上入力してください' },
        { status: 400 }
      );
    }

    if (consultationText.length > MAX_CONSULTATION_TEXT_LENGTH) {
      return NextResponse.json(
        { error: `相談内容は${MAX_CONSULTATION_TEXT_LENGTH}文字以内で入力してください` },
        { status: 400 }
      );
    }

    // Gemini APIで分類
    const result = await classifySDGs(consultationText);

    if (!result.success) {
      return NextResponse.json(
        { error: 'AI分類に失敗しました', details: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

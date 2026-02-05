// app/api/classify-sdgs/route.ts
// SDGsゴール分類APIエンドポイント

import { NextRequest, NextResponse } from 'next/server';
import { classifySDGs } from '@/lib/gemini';

export async function POST(request: NextRequest) {
    try {
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
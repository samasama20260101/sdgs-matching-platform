import { NextRequest, NextResponse } from 'next/server';
import { classifySDGs } from '@/lib/gemini';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { description } = body;

        if (!description || typeof description !== 'string') {
            return NextResponse.json(
                { error: '相談内容が必要です' },
                { status: 400 }
            );
        }

        const result = await classifySDGs(description);

        if (!result.success) {
            return NextResponse.json(
                { error: 'AI分析に失敗しました', details: result.error },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            analysis: result.data,
        });
    } catch (error) {
        console.error('Gemini Analyze API Error:', error);
        return NextResponse.json(
            { error: 'サーバーエラーが発生しました' },
            { status: 500 }
        );
    }
}
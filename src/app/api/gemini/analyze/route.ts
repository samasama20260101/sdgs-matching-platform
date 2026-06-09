import { NextRequest, NextResponse } from 'next/server';
import { requireActiveAppUser } from '@/lib/api/auth';
import { isUuid } from '@/lib/api/validation';
import { classifySDGs } from '@/lib/gemini';
import { supabaseAdmin } from '@/lib/supabase/server';

const MAX_DESCRIPTION_LENGTH = 10000;

export async function POST(request: NextRequest) {
    try {
        const auth = await requireActiveAppUser(request, { roles: ['SOS', 'ADMIN'] });
        if ('response' in auth) return auth.response;

        const body = await request.json();
        const { caseId, description } = body;

        if (!description || typeof description !== 'string') {
            return NextResponse.json(
                { error: '相談内容が必要です' },
                { status: 400 }
            );
        }

        if (description.length > MAX_DESCRIPTION_LENGTH) {
            return NextResponse.json(
                { error: `相談内容は${MAX_DESCRIPTION_LENGTH}文字以内で入力してください` },
                { status: 400 }
            );
        }

        if (caseId !== undefined) {
            if (!isUuid(caseId)) {
                return NextResponse.json(
                    { error: '案件IDが不正です' },
                    { status: 400 }
                );
            }

            const { data: caseData, error: caseError } = await supabaseAdmin
                .from('cases')
                .select('id, owner_user_id')
                .eq('id', caseId)
                .maybeSingle();

            if (caseError) {
                console.error('[api/gemini/analyze] case fetch error:', caseError);
                return NextResponse.json(
                    { error: 'サーバーエラーが発生しました' },
                    { status: 500 }
                );
            }

            if (!caseData) {
                return NextResponse.json(
                    { error: '案件が見つかりません' },
                    { status: 404 }
                );
            }

            if (auth.appUser.role !== 'ADMIN' && caseData.owner_user_id !== auth.appUser.id) {
                return NextResponse.json(
                    { error: 'Forbidden' },
                    { status: 403 }
                );
            }
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

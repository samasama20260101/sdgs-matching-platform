import { NextRequest, NextResponse } from 'next/server';
import { requireActiveAppUser } from '@/lib/api/auth';
import { isUuid } from '@/lib/api/validation';
import { classifySDGs } from '@/lib/gemini';
import { supabaseAdmin } from '@/lib/supabase/server';

const MAX_DESCRIPTION_LENGTH = 10000;
const FALLBACK_TITLE = '再度見直してください';

type CaseForAnalysis = {
    id: string;
    owner_user_id: string;
    description_free: string | null;
    intake_qna: unknown;
    locale?: string | null;
};

// 二言語生成（設計§5.7）: 相談者言語がjaの場合 *_ja フィールドは付かない。
// 相談者向けフィールド（title/summary/per_goal/keywords）は相談者の言語、
// *_ja はサポーター向けの日本語版。
type NormalizedAnalysis = {
    locale: string;
    title: string;
    title_ja?: string;
    sdgs_goals: number[];
    summary: string;
    summary_ja?: string;
    per_goal: Array<{
        goal: number;
        title: string;
        explanation: string;
        title_ja?: string;
        explanation_ja?: string;
    }>;
    keywords: string[];
    keywords_ja?: string[];
};

function truncateText(value: unknown, maxLength: number) {
    return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function buildDescriptionFromCase(caseData: CaseForAnalysis) {
    const qna = caseData.intake_qna && typeof caseData.intake_qna === 'object'
        ? (caseData.intake_qna as { qa?: Record<string, unknown> }).qa
        : null;
    const qaText = qna && typeof qna === 'object'
        ? Object.entries(qna)
            .filter(([, answers]) => Array.isArray(answers)
                && answers.length > 0
                && !(answers.length === 1 && answers[0] === '該当なし'))
            .map(([q, answers]) => {
                const safeAnswers = (answers as unknown[])
                    .map((answer) => truncateText(answer, 120))
                    .filter(Boolean)
                return safeAnswers.length > 0 ? `Q${q}: ${safeAnswers.join('、')}` : ''
            })
            .filter(Boolean)
            .join('\n')
        : '';

    return [qaText, truncateText(caseData.description_free, MAX_DESCRIPTION_LENGTH)]
        .filter(Boolean)
        .join('\n\n')
        .slice(0, MAX_DESCRIPTION_LENGTH);
}

function normalizeAnalysis(raw: unknown, locale: string = 'ja'): NormalizedAnalysis {
    const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const isBilingual = locale !== 'ja';
    const goals = Array.isArray(source.sdgs_goals)
        ? [...new Set(source.sdgs_goals
            .map((goal) => Number(goal))
            .filter((goal) => Number.isInteger(goal) && goal >= 1 && goal <= 17))]
            .slice(0, 3)
        : [];

    const rawPerGoal = Array.isArray(source.per_goal) ? source.per_goal : [];
    const perGoal = goals
        .map((goal) => {
            const match = rawPerGoal.find((item) => item
                && typeof item === 'object'
                && Number((item as Record<string, unknown>).goal) === goal) as Record<string, unknown> | undefined;
            if (!match) return null;
            return {
                goal,
                title: truncateText(match.title, 80),
                explanation: truncateText(match.explanation, 600),
                ...(isBilingual ? {
                    title_ja: truncateText(match.title_ja, 80) || undefined,
                    explanation_ja: truncateText(match.explanation_ja, 600) || undefined,
                } : {}),
            };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null && !!item.title && !!item.explanation);

    const title = goals.length > 0
        ? truncateText(source.title, 40) || '相談内容を確認中'
        : (isBilingual ? truncateText(source.title, 40) || FALLBACK_TITLE : FALLBACK_TITLE);
    const summary = truncateText(source.summary, 1000)
        || (goals.length > 0
            ? '相談内容をもとに、関連しそうな支援分野を整理しました。'
            : 'もう少し詳しく教えてもらえると、より適切な支援者につなぐことができます。');
    const keywords = Array.isArray(source.keywords)
        ? [...new Set(source.keywords.map((keyword) => truncateText(keyword, 40)).filter(Boolean))].slice(0, 8)
        : [];

    return {
        locale,
        title,
        sdgs_goals: goals,
        summary,
        per_goal: perGoal,
        keywords,
        ...(isBilingual ? {
            title_ja: truncateText(source.title_ja, 40) || (goals.length === 0 ? FALLBACK_TITLE : undefined),
            summary_ja: truncateText(source.summary_ja, 1000) || undefined,
            keywords_ja: Array.isArray(source.keywords_ja)
                ? [...new Set(source.keywords_ja.map((keyword) => truncateText(keyword, 40)).filter(Boolean))].slice(0, 8)
                : undefined,
        } : {}),
    };
}

export async function POST(request: NextRequest) {
    try {
        const auth = await requireActiveAppUser(request, { roles: ['SOS', 'ADMIN'] });
        if ('response' in auth) return auth.response;

        const body = await request.json();
        const { caseId, description } = body;
        let analysisDescription: string | null = null;
        let targetCaseId: string | null = null;
        let caseLocale = 'ja';

        if (caseId !== undefined) {
            if (!isUuid(caseId)) {
                return NextResponse.json(
                    { error: '案件IDが不正です' },
                    { status: 400 }
                );
            }

            const { data: caseData, error: caseError } = await supabaseAdmin
                .from('cases')
                .select('id, owner_user_id, description_free, intake_qna, locale')
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

            analysisDescription = buildDescriptionFromCase(caseData as CaseForAnalysis);
            targetCaseId = caseData.id;
            caseLocale = (caseData as CaseForAnalysis).locale || 'ja';
        } else {
            if (!description || typeof description !== 'string') {
                return NextResponse.json(
                    { error: '相談内容が必要です' },
                    { status: 400 }
                );
            }
            analysisDescription = description.trim().slice(0, MAX_DESCRIPTION_LENGTH);
        }

        if (!analysisDescription) {
            return NextResponse.json(
                { error: '相談内容が必要です' },
                { status: 400 }
            );
        }

        if (analysisDescription.length > MAX_DESCRIPTION_LENGTH) {
            return NextResponse.json(
                { error: `相談内容は${MAX_DESCRIPTION_LENGTH}文字以内で入力してください` },
                { status: 400 }
            );
        }

        const result = await classifySDGs(analysisDescription, caseLocale);

        if (!result.success) {
            return NextResponse.json(
                { error: 'AI分析に失敗しました', details: result.error },
                { status: 500 }
            );
        }

        const analysis = normalizeAnalysis(result.data, caseLocale);

        if (targetCaseId) {
            const { error: updateError } = await supabaseAdmin
                .from('cases')
                .update({
                    ai_sdg_suggestion: analysis,
                    // cases.title は日本語を正とする（サポーター一覧・管理画面の可読性）。
                    // 相談者言語のタイトルは ai_sdg_suggestion.title に保持し、SOS側画面はそちらを優先表示。
                    title: analysis.title_ja || analysis.title,
                    visibility: 'LISTED',
                })
                .eq('id', targetCaseId);

            if (updateError) {
                console.error('[api/gemini/analyze] case analysis update error:', updateError);
                return NextResponse.json(
                    { error: 'サーバーエラーが発生しました' },
                    { status: 500 }
                );
            }
        }

        return NextResponse.json({
            success: true,
            analysis,
        });
    } catch (error) {
        console.error('Gemini Analyze API Error:', error);
        return NextResponse.json(
            { error: 'サーバーエラーが発生しました' },
            { status: 500 }
        );
    }
}

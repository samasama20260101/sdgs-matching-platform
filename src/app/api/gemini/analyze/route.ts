import { NextRequest, NextResponse } from 'next/server';
import { requireActiveAppUser } from '@/lib/api/auth';
import { isUuid } from '@/lib/api/validation';
import { classifySDGs, sanitizeAiLabels, type ConcernContext } from '@/lib/gemini';
import { supabaseAdmin } from '@/lib/supabase/server';
import { describeConcernsJa, getCaseConcerns, sdgsHintFromLabels, type ConcernLabelId } from '@/lib/constants/concerns';
import { buildCaseAnalysisText } from '@/lib/api/caseText';

const MAX_DESCRIPTION_LENGTH = 10000;
const FALLBACK_TITLE = '再度見直してください';

type CaseForAnalysis = {
    id: string;
    owner_user_id: string;
    title: string | null;
    description_free: string | null;
    intake_qna: unknown;
};

type NormalizedAnalysis = {
    title: string;
    labels_ai: ConcernLabelId[];
    sdgs_goals: number[];
    summary: string;
    per_goal: Array<{
        goal: number;
        title: string;
        explanation: string;
    }>;
    keywords: string[];
};

function truncateText(value: unknown, maxLength: number) {
    return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

// 新フォームの本人の選択(括り・項目・ほしい助け)を AI に渡す文脈に整える。旧フォームは null
function buildConcernContext(caseData: CaseForAnalysis): ConcernContext | null {
    const concerns = getCaseConcerns(caseData.intake_qna);
    if (!concerns) return null;
    return {
        selectionText: describeConcernsJa(caseData.intake_qna),
        ownLabels: concerns.labels,
    };
}

// AI が使えないとき(キー未設定・失敗)の既定値(仕様 §6.2)。
// sdgs_goals は本人ラベルの SDGs ヒントの和集合、labels_ai は空。案件の公開は止めない。
// title は案件の現タイトル(本人の自由記述の冒頭)を据え置く。summary はサポーター向け(日本語固定)で、
// 相談者側の結果ページは fallback フラグを見て翻訳済み文言を出す。
// fallback: true の案件は結果ページの再読み込みで AI 分析を再試行し、成功すれば上書きされる(恒久固定を避ける)
type FallbackAnalysis = NormalizedAnalysis & { fallback: true };

function buildFallbackAnalysis(caseData: CaseForAnalysis, currentTitle: string): FallbackAnalysis {
    const concerns = getCaseConcerns(caseData.intake_qna);
    const goals = sdgsHintFromLabels(concerns?.labels ?? []).slice(0, 3);
    return {
        title: truncateText(currentTitle, 80) || '相談',
        labels_ai: [],
        sdgs_goals: goals,
        summary: 'AIの要約は取得できませんでした。本人が選んだお困りごとと相談内容をそのまま確認してください。',
        per_goal: [],
        keywords: [],
        fallback: true,
    };
}

function normalizeAnalysis(raw: unknown, ownLabels: ConcernLabelId[] = [], currentTitle = ''): NormalizedAnalysis {
    const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    // AI 補完ラベル: 8 id 以外は捨て、本人ラベルとの差集合を取り、上限で切る
    const labelsAi = sanitizeAiLabels(source.labels_ai, ownLabels);
    const aiGoals = Array.isArray(source.sdgs_goals)
        ? [...new Set(source.sdgs_goals
            .map((goal) => Number(goal))
            .filter((goal) => Number.isInteger(goal) && goal >= 1 && goal <= 17))]
            .slice(0, 3)
        : [];
    // 新フォームで本人がお困りごとを選んでいるのに AI がゴールを決められなかった場合は、
    // ラベルの SDGs ヒントを既定値にし、「再度見直してください」扱いにはしない(本人の言葉が正)
    const usedHintGoals = aiGoals.length === 0 && ownLabels.length > 0;
    const goals = usedHintGoals ? sdgsHintFromLabels(ownLabels).slice(0, 3) : aiGoals;

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
            };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null && !!item.title && !!item.explanation);

    const aiTitle = truncateText(source.title, 40);
    const title = usedHintGoals
        ? (aiTitle && aiTitle !== FALLBACK_TITLE ? aiTitle : truncateText(currentTitle, 80) || '相談')
        : goals.length > 0
            ? aiTitle || '相談内容を確認中'
            : FALLBACK_TITLE;
    const summary = truncateText(source.summary, 1000)
        || (goals.length > 0
            ? '相談内容をもとに、関連しそうな支援分野を整理しました。'
            : 'もう少し詳しく教えてもらえると、より適切な支援者につなぐことができます。');
    const keywords = Array.isArray(source.keywords)
        ? [...new Set(source.keywords.map((keyword) => truncateText(keyword, 40)).filter(Boolean))].slice(0, 8)
        : [];

    return {
        title,
        labels_ai: labelsAi,
        sdgs_goals: goals,
        summary,
        per_goal: perGoal,
        keywords,
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
        let targetCase: CaseForAnalysis | null = null;
        let concernContext: ConcernContext | null = null;

        if (caseId !== undefined) {
            if (!isUuid(caseId)) {
                return NextResponse.json(
                    { error: '案件IDが不正です' },
                    { status: 400 }
                );
            }

            const { data: caseData, error: caseError } = await supabaseAdmin
                .from('cases')
                .select('id, owner_user_id, title, description_free, intake_qna')
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

            // 災害SOS案件はAI分類の対象外(API直叩きでも分析させない)
            const intake = caseData.intake_qna as { disaster?: unknown } | null
            if (intake?.disaster) {
                return NextResponse.json(
                    { error: '災害SOS案件はAI分析の対象外です' },
                    { status: 400 }
                );
            }

            targetCase = caseData as CaseForAnalysis;
            analysisDescription = buildCaseAnalysisText(targetCase);
            concernContext = buildConcernContext(targetCase);
            targetCaseId = caseData.id;
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

        const result = await classifySDGs(analysisDescription, concernContext ?? undefined);

        // 新フォームの案件は AI が失敗しても公開を止めない(本人の言葉だけでサポーターは探せる)。
        // 旧フォームの案件は従来どおり 500 を返し、結果ページの再試行に任せる
        let analysis: NormalizedAnalysis | FallbackAnalysis;
        let fallback = false;
        if (result.success) {
            analysis = normalizeAnalysis(result.data, concernContext?.ownLabels ?? [], targetCase?.title ?? '');
        } else if (targetCase && concernContext) {
            console.error('[api/gemini/analyze] AI failed, using concern fallback:', result.error);
            analysis = buildFallbackAnalysis(targetCase, targetCase.title ?? '');
            fallback = true;
        } else {
            return NextResponse.json(
                { error: 'AI分析に失敗しました', details: result.error },
                { status: 500 }
            );
        }

        if (targetCaseId) {
            const { error: updateError } = await supabaseAdmin
                .from('cases')
                .update({
                    ai_sdg_suggestion: analysis,
                    title: analysis.title,
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
            ...(fallback ? { fallback: true } : {}),
        });
    } catch (error) {
        console.error('Gemini Analyze API Error:', error);
        return NextResponse.json(
            { error: 'サーバーエラーが発生しました' },
            { status: 500 }
        );
    }
}

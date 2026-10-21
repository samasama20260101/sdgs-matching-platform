import { NextRequest, NextResponse } from 'next/server';
import { requireActiveAppUser } from '@/lib/api/auth';
import { isUuid } from '@/lib/api/validation';
import { classifySDGs } from '@/lib/gemini';
import { stripLinks } from '@/lib/aiSafety';
import { buildIntakeTextForAi, categoriesFromIndicators, findIndicator, sanitizeIndicatorIds } from '@/lib/constants/intakeIndicators';
import { supabaseAdmin } from '@/lib/supabase/server';

const MAX_DESCRIPTION_LENGTH = 10000;
const FALLBACK_TITLE = '再度見直してください';

type CaseForAnalysis = {
    id: string;
    owner_user_id: string;
    description_free: string | null;
    intake_qna: unknown;
};

type NormalizedAnalysis = {
    title: string;
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

// AI が書いた文: URL・メールアドレスを取り除いてから長さで切る(プロンプトインジェクション対策)
function cleanAiText(value: unknown, maxLength: number) {
    return typeof value === 'string' ? truncateText(stripLinks(value), maxLength) : '';
}

// 新形式(version 2): 選んだ困りごとの指標 ID。旧 Q1〜Q5 形式の案件は null
function indicatorIdsFromCase(caseData: CaseForAnalysis): string[] | null {
    const intake = caseData.intake_qna && typeof caseData.intake_qna === 'object'
        ? caseData.intake_qna as { version?: unknown; indicators?: unknown }
        : null;
    if (intake?.version !== 2) return null;
    return sanitizeIndicatorIds(intake.indicators);
}

function buildDescriptionFromCase(caseData: CaseForAnalysis) {
    const indicatorIds = indicatorIdsFromCase(caseData);
    if (indicatorIds) {
        // AI には相談者の表示言語ではなく正本(日本語)の文言を渡す
        const texts = indicatorIds.map((id) => findIndicator(id)!.text);
        return buildIntakeTextForAi('選んだ困りごと', texts, truncateText(caseData.description_free, MAX_DESCRIPTION_LENGTH))
            .slice(0, MAX_DESCRIPTION_LENGTH);
    }

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

// fixedGoals: 相談フォームの選択肢から決めた大項目。渡したときは AI の返す番号を使わない
function normalizeAnalysis(raw: unknown, fixedGoals?: number[]): NormalizedAnalysis {
    const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const goals = fixedGoals ?? (Array.isArray(source.sdgs_goals)
        ? [...new Set(source.sdgs_goals
            .map((goal) => Number(goal))
            .filter((goal) => Number.isInteger(goal) && goal >= 1 && goal <= 17))]
            .slice(0, 3)
        : []);

    const rawPerGoal = Array.isArray(source.per_goal) ? source.per_goal : [];
    const perGoal = goals
        .map((goal) => {
            const match = rawPerGoal.find((item) => item
                && typeof item === 'object'
                && Number((item as Record<string, unknown>).goal) === goal) as Record<string, unknown> | undefined;
            if (!match) return null;
            return {
                goal,
                title: cleanAiText(match.title, 80),
                explanation: cleanAiText(match.explanation, 600),
            };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null && !!item.title && !!item.explanation);

    const title = goals.length > 0
        ? cleanAiText(source.title, 40) || '相談内容を確認中'
        : FALLBACK_TITLE;
    const summary = cleanAiText(source.summary, 1000)
        || (goals.length > 0
            ? '相談内容をもとに、関連しそうな支援分野を整理しました。'
            : 'もう少し詳しく教えてもらえると、より適切な支援者につなぐことができます。');
    const keywords = Array.isArray(source.keywords)
        ? [...new Set(source.keywords.map((keyword) => cleanAiText(keyword, 40)).filter(Boolean))].slice(0, 8)
        : [];

    return {
        title,
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
        let fixedGoals: number[] | undefined;

        if (caseId !== undefined) {
            if (!isUuid(caseId)) {
                return NextResponse.json(
                    { error: '案件IDが不正です' },
                    { status: 400 }
                );
            }

            const { data: caseData, error: caseError } = await supabaseAdmin
                .from('cases')
                .select('id, owner_user_id, description_free, intake_qna, ai_sdg_suggestion')
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

            // AI 分析は 1 案件につき 1 回(課金の使いすぎ対策)。分析済みなら AI を動かさず保存済みの結果を返す
            if (caseData.ai_sdg_suggestion) {
                return NextResponse.json({ success: true, analysis: caseData.ai_sdg_suggestion });
            }

            // 災害SOS案件はAI分類の対象外(API直叩きでも分析させない)
            const intake = caseData.intake_qna as { disaster?: unknown } | null
            if (intake?.disaster) {
                return NextResponse.json(
                    { error: '災害SOS案件はAI分析の対象外です' },
                    { status: 400 }
                );
            }

            analysisDescription = buildDescriptionFromCase(caseData as CaseForAnalysis);
            // 新形式の案件は選択肢から大項目を決める(0 個なら 18)。AI は分類しない
            const indicatorIds = indicatorIdsFromCase(caseData as CaseForAnalysis);
            if (indicatorIds) fixedGoals = categoriesFromIndicators(indicatorIds);
            targetCaseId = caseData.id;
        } else {
            // 案件を指定しない分析は管理者だけ(画面では使っていない。相談者が任意の文で AI を動かせないようにする)
            if (auth.appUser.role !== 'ADMIN') {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
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

        const result = await classifySDGs(analysisDescription, fixedGoals);

        if (!result.success) {
            return NextResponse.json(
                { error: 'AI分析に失敗しました', details: result.error },
                { status: 500 }
            );
        }

        const analysis = normalizeAnalysis(result.data, fixedGoals);

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
        });
    } catch (error) {
        console.error('Gemini Analyze API Error:', error);
        return NextResponse.json(
            { error: 'サーバーエラーが発生しました' },
            { status: 500 }
        );
    }
}

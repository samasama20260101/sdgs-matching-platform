// AI 分析に渡す相談文の組み立て(analyze API と遡り付与 API で共用)。
// 旧フォームの Q1〜Q5 の回答テキスト + 自由記述。新フォーム(qa 無し)は自由記述だけになる。
// 新フォームの本人の選択は describeConcernsJa(concerns.ts)で別枝として渡す。
export const MAX_ANALYSIS_TEXT_LENGTH = 10000

function truncateText(value: unknown, maxLength: number) {
    return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

export function buildCaseAnalysisText(caseData: { description_free: string | null; intake_qna: unknown }) {
    const qna = caseData.intake_qna && typeof caseData.intake_qna === 'object'
        ? (caseData.intake_qna as { qa?: Record<string, unknown> }).qa
        : null
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
        : ''

    return [qaText, truncateText(caseData.description_free, MAX_ANALYSIS_TEXT_LENGTH)]
        .filter(Boolean)
        .join('\n\n')
        .slice(0, MAX_ANALYSIS_TEXT_LENGTH)
}

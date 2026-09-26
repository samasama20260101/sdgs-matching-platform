// お困りごとラベルのチップ(サポーター・管理者UI向け・日本語固定)。
// 実線 = 本人がチェックした項目から決まったラベル / 破線 + 「AI」印 = 自由記述から AI が足した推定。
// 「本人の言葉」と「AI の推定」を混ぜない、が要点(仕様_お困りごとラベル §2・§5.3)。
import { getConcernLabel, type ConcernLabelId } from '@/lib/constants/concerns'

export const AI_LABEL_HINT = 'AI の推定です。本人は選んでいません'

export function ConcernLabelChip({ labelId, ai = false, size = 'sm' }: { labelId: ConcernLabelId; ai?: boolean; size?: 'sm' | 'md' }) {
  const label = getConcernLabel(labelId)
  if (!label) return null
  const sizeCls = size === 'md' ? 'text-xs px-2.5 py-1' : 'text-[11px] px-2 py-0.5'
  return ai ? (
    <span
      title={AI_LABEL_HINT}
      className={`inline-flex items-center gap-1 ${sizeCls} rounded-full border border-dashed border-violet-300 bg-white text-violet-700`}
    >
      <span className="text-[9px] font-bold leading-none px-1 py-0.5 rounded bg-violet-100 text-violet-700">AI</span>
      {label.nameJa}
    </span>
  ) : (
    <span className={`inline-flex items-center ${sizeCls} rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 font-medium`}>
      {label.nameJa}
    </span>
  )
}

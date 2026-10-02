// 相談フォームの入力欄(Q1〜Q5 の選択肢 + 自由記述)。
// 本番の相談フォーム(/sos/hearing)と体験ページ(/trial)が同じものを使う。
// 設問・選択肢の文言は messages/*/sos.json(sos.questions / sos.hearing)で管理し、
// ここには ID・緊急フラグ・排他フラグだけを持つ。送信や保存はしない(呼び出し側の仕事)。
'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

// 入力上限
export const CHAR_LIMITS = {
  what: 1000,
  when: 200,
  want: 200,
};

export type QAOption = {
  id: string;
  urgent?: boolean;
  exclusive?: boolean;
};

export type QAQuestion = {
  id: number;
  options: QAOption[];
};

export type IntakeSelections = Record<number, Set<string>>;
export type IntakeFreeText = { what: string; when: string; want: string };

// ─── Q&A構造の定義（文言は sos.questions.* に外出し済み） ─────
export const QA_QUESTIONS: QAQuestion[] = [
  { id: 1, options: [{ id: 'q1_1' }, { id: 'q1_2' }, { id: 'q1_3' }, { id: 'q1_4' }, { id: 'q1_5', exclusive: true }] },
  { id: 2, options: [{ id: 'q2_1' }, { id: 'q2_2' }, { id: 'q2_3' }, { id: 'q2_4' }, { id: 'q2_5', exclusive: true }] },
  { id: 3, options: [{ id: 'q3_1' }, { id: 'q3_2' }, { id: 'q3_3' }, { id: 'q3_4' }, { id: 'q3_5', exclusive: true }] },
  { id: 4, options: [{ id: 'q4_1' }, { id: 'q4_2', urgent: true }, { id: 'q4_3' }, { id: 'q4_4' }, { id: 'q4_5', exclusive: true }] },
  { id: 5, options: [{ id: 'q5_1' }, { id: 'q5_2' }, { id: 'q5_3' }, { id: 'q5_4' }, { id: 'q5_5' }, { id: 'q5_6', exclusive: true }] },
];

// チェックボックスの切り替え（「該当なし」は排他制御）
export function toggleIntakeOption(prev: IntakeSelections, question: QAQuestion, option: QAOption): IntakeSelections {
  const current = new Set(prev[question.id] || []);
  const exclusiveOptionId = question.options.find(item => item.exclusive)?.id;
  if (option.exclusive) {
    // 「該当なし」を選んだら他をすべて外す
    if (current.has(option.id)) {
      current.delete(option.id);
    } else {
      current.clear();
      current.add(option.id);
    }
  } else {
    // 他の選択肢を選んだら「該当なし」を外す
    if (exclusiveOptionId) current.delete(exclusiveOptionId);
    if (current.has(option.id)) current.delete(option.id);
    else current.add(option.id);
  }
  return { ...prev, [question.id]: current };
}

// ─── 文字数カウンター ────────────────────────────────────────
function CharCounter({ current, max }: { current: number; max: number }) {
  return (
    <div className={`text-right text-[11px] mt-1 ${current > max ? 'text-red-500 font-medium' : current > max * 0.8 ? 'text-amber-500' : 'text-gray-400'}`}>
      {current} / {max}
    </div>
  );
}

type Props = {
  selectedOptionIds: IntakeSelections;
  onToggleOption: (question: QAQuestion, option: QAOption) => void;
  freeText: IntakeFreeText;
  onFreeTextChange: (next: IntakeFreeText) => void;
};

export default function IntakeFormFields({ selectedOptionIds, onToggleOption, freeText, onFreeTextChange }: Props) {
  const t = useTranslations('sos.hearing');
  const tQ = useTranslations('sos.questions');

  return (
    <>
      {/* Q&Aフォーム */}
      {QA_QUESTIONS.map((question) => (
        <Card key={question.id}>
          <CardHeader>
            <CardTitle className="text-base font-medium">
              Q{question.id}. {tQ(`q${question.id}.question`)} <span className="text-red-500">*</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {question.options.map((option) => {
                const isChecked = selectedOptionIds[question.id]?.has(option.id) || false;
                const isNone = Boolean(option.exclusive);
                return (
                  <label
                    key={option.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      isChecked
                        ? isNone ? 'bg-gray-100 border-gray-400' : 'bg-blue-50 border-blue-300'
                        : isNone ? 'hover:bg-gray-50 border-dashed border-gray-200' : 'hover:bg-gray-50 border-gray-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => onToggleOption(question, option)}
                      className="mt-0.5 text-blue-600 rounded"
                    />
                    <span className={`text-sm leading-relaxed ${isNone ? 'text-gray-400' : ''}`}>{tQ(`q${question.id}.options.${option.id}`)}</span>
                  </label>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* 自由記述 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">{t('freeSectionTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 個人情報を書かせないための注意喚起。あとからのマスキングに頼らず入力段階で防ぐ
              （設計書 §5.2 と同じ思想）。送信はブロックしない */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-bold text-amber-900">{t('noPersonalInfoTitle')}</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-800">{t('noPersonalInfoBody')}</p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="what">
              {t('whatLabel')} <span className="text-red-500">*</span>
            </Label>
            <p className="text-xs text-gray-400 mb-1">
              {t('whatHint')}
            </p>
            <textarea
              id="what"
              rows={4}
              maxLength={CHAR_LIMITS.what}
              className="w-full p-3 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder={t('whatPlaceholder')}
              value={freeText.what}
              onChange={(e) => onFreeTextChange({ ...freeText, what: e.target.value })}
            />
            <CharCounter current={freeText.what.length} max={CHAR_LIMITS.what} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="when">{t('whenLabel')}</Label>
            <textarea
              id="when"
              rows={2}
              maxLength={CHAR_LIMITS.when}
              className="w-full p-3 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder={t('whenPlaceholder')}
              value={freeText.when}
              onChange={(e) => onFreeTextChange({ ...freeText, when: e.target.value })}
            />
            <CharCounter current={freeText.when.length} max={CHAR_LIMITS.when} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="want">{t('wantLabel')}</Label>
            <textarea
              id="want"
              rows={2}
              maxLength={CHAR_LIMITS.want}
              className="w-full p-3 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder={t('wantPlaceholder')}
              value={freeText.want}
              onChange={(e) => onFreeTextChange({ ...freeText, want: e.target.value })}
            />
            <CharCounter current={freeText.want.length} max={CHAR_LIMITS.want} />
          </div>
        </CardContent>
      </Card>
    </>
  );
}

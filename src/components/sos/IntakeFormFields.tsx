// 相談フォームの入力欄(困りごとの選択肢 0〜3 個 + 自由記述)。
// 本番の相談フォーム(/sos/hearing)と体験ページ(/trial)が同じものを使う。
// 選択肢は SDGs のグローバル指標ごと(正本は docs/intake_indicators.md、定義は constants/intakeIndicators.ts)。
// 文言は messages/*/sdgs.json(category / indicator)と sos.json(sos.questions / sos.hearing)。送信や保存はしない(呼び出し側の仕事)。
'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { SDG_COLORS } from '@/lib/constants/sdgs';
import {
  MAX_INDICATOR_SELECTIONS,
  SELECTABLE_CATEGORIES,
  findIndicator,
  indicatorMessageKey,
  indicatorsInCategory,
} from '@/lib/constants/intakeIndicators';

// 入力上限
export const CHAR_LIMITS = {
  what: 1000,
  when: 200,
  want: 200,
};

export type IntakeFreeText = { what: string; when: string; want: string };

// 選択肢の切り替え(上限に達していたら追加しない)
export function toggleIndicator(prev: string[], id: string): string[] {
  if (prev.includes(id)) return prev.filter((item) => item !== id);
  if (prev.length >= MAX_INDICATOR_SELECTIONS) return prev;
  return [...prev, id];
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
  selectedIndicatorIds: string[];
  onToggleIndicator: (id: string) => void;
  freeText: IntakeFreeText;
  onFreeTextChange: (next: IntakeFreeText) => void;
  // 自由記述欄の上に置く操作(体験ページの「例文を入れてみる」など)
  freeTextAction?: React.ReactNode;
};

export default function IntakeFormFields({ selectedIndicatorIds, onToggleIndicator, freeText, onFreeTextChange, freeTextAction }: Props) {
  const t = useTranslations('sos.hearing');
  const tQ = useTranslations('sos.questions');
  const tSdgs = useTranslations('sdgs');
  const isFull = selectedIndicatorIds.length >= MAX_INDICATOR_SELECTIONS;

  return (
    <>
      {/* 困りごとの選択(0〜3 個) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">{tQ('title', { max: MAX_INDICATOR_SELECTIONS })}</CardTitle>
          <p className="text-xs text-gray-500 leading-relaxed mt-1">{tQ('intro', { max: MAX_INDICATOR_SELECTIONS })}</p>
          <p className="text-xs text-teal-700 bg-teal-50 border border-teal-100 rounded-lg p-2.5 leading-relaxed mt-2">
            {tQ('neighborNote', { label: tSdgs('category.18') })}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* 選んだもの */}
          <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3">
            <p className="text-xs font-bold text-gray-600 mb-2">
              {tQ('selectedHeading')}
              <span className="ml-2 font-normal text-gray-500">{tQ('selectedCount', { count: selectedIndicatorIds.length, max: MAX_INDICATOR_SELECTIONS })}</span>
            </p>
            {selectedIndicatorIds.length === 0 ? (
              <p className="text-xs text-gray-400">{tQ('noneSelected')}</p>
            ) : (
              <ul className="space-y-1.5">
                {selectedIndicatorIds.map((id) => {
                  const indicator = findIndicator(id);
                  if (!indicator) return null;
                  return (
                    <li key={id} className="flex items-start gap-2 text-sm">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: SDG_COLORS[indicator.category] }} />
                      <span className="flex-1 leading-relaxed">{tSdgs(`indicator.${indicatorMessageKey(id)}`)}</span>
                      <button
                        type="button"
                        onClick={() => onToggleIndicator(id)}
                        className="shrink-0 text-xs text-gray-400 hover:text-red-500 underline"
                      >
                        {tQ('remove')}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {isFull && <p className="text-[11px] text-amber-600 mt-2">{tQ('limitReached', { max: MAX_INDICATOR_SELECTIONS })}</p>}
          </div>

          {/* 大項目ごとに開いて選ぶ */}
          <div className="space-y-2">
            {SELECTABLE_CATEGORIES.map((category) => {
              const options = indicatorsInCategory(category);
              const selectedHere = options.filter((option) => selectedIndicatorIds.includes(option.id)).length;
              return (
                <details key={category} className="group rounded-lg border border-gray-200 bg-white">
                  <summary className="flex cursor-pointer list-none items-center gap-2 p-3 text-sm font-medium text-gray-700">
                    <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: SDG_COLORS[category] }} />
                    <span className="flex-1">{tSdgs(`category.${category}`)}</span>
                    {selectedHere > 0 && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-600">{selectedHere}</span>
                    )}
                    <span className="text-gray-400 transition-transform group-open:rotate-180">▾</span>
                  </summary>
                  <div className="space-y-2 border-t border-gray-100 p-3">
                    {options.map((option) => {
                      const isChecked = selectedIndicatorIds.includes(option.id);
                      const isDisabled = !isChecked && isFull;
                      return (
                        <label
                          key={option.id}
                          className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                            isChecked
                              ? 'bg-blue-50 border-blue-300 cursor-pointer'
                              : isDisabled
                                ? 'border-gray-100 opacity-50 cursor-not-allowed'
                                : 'hover:bg-gray-50 border-gray-200 cursor-pointer'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={isDisabled}
                            onChange={() => onToggleIndicator(option.id)}
                            className="mt-0.5 text-blue-600 rounded"
                          />
                          <span className="text-sm leading-relaxed">{tSdgs(`indicator.${indicatorMessageKey(option.id)}`)}</span>
                        </label>
                      );
                    })}
                  </div>
                </details>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 自由記述 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">{t('freeSectionTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {freeTextAction}

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

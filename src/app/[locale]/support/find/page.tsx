'use client'

// 支える｜相談をさがす(盤 22)。だれの相談か・大項目・遠隔を含める・関わり方で絞る。待っている時間が長い順。
// 大項目の名前は相談した人の種類で変わる(src/lib/domain/supportAreas.ts)ので、大項目は種類を選んでから選ぶ
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiFetch } from '@/lib/client/api'
import { Link } from '@/i18n/navigation'
import { AppFrame } from '@/components/app/AppShell'
import { RequireMe } from '@/components/app/RequireMe'
import { Button, Card, Heading, Lead, Tip, Toggle } from '@/components/app/ui'
import { CaseCard } from '@/components/support/CaseCard'
import { FacePicker, useFace } from '@/components/support/useFace'
import type { SupportCaseItem } from '@/lib/server/supportCases'
import { AREA_GOALS, areaSubjectsForFace, type AreaSubject } from '@/lib/domain/supportAreas'

function Find() {
  const t = useTranslations('support.find')
  const tHome = useTranslations('support.home')
  const tSdgs = useTranslations('sdgs')
  const { options, current, choose } = useFace()
  const [subject, setSubject] = useState<AreaSubject | null>(null)
  const [category, setCategory] = useState<number | null>(null)
  const [remote, setRemote] = useState(false)
  const [involvement, setInvolvement] = useState<'all' | 'notOffered' | 'mine'>('notOffered')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [items, setItems] = useState<SupportCaseItem[] | null>(null)
  const [lockedCount, setLockedCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // 1 回に 50 件ずつ。「もっと見る」で続きを足す(絞り込みは API の中で行う)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const query = (offset: number) => {
    const q = new URLSearchParams({ face: current?.key ?? '', involvement })
    if (subject) q.set('subject', subject)
    if (subject && category) q.set('category', String(category))
    if (remote) q.set('remote', '1')
    if (offset > 0) q.set('offset', String(offset))
    return `/api/support/cases?${q}`
  }
  const [nextOffset, setNextOffset] = useState(0)
  useEffect(() => {
    if (!current) return
    let alive = true
    setItems(null)
    apiFetch<{ cases: SupportCaseItem[]; lockedCount: number; hasMore: boolean; nextOffset: number }>(query(0))
      .then((d) => { if (!alive) return; setItems(d.cases.filter((c) => !c.locked)); setLockedCount(d.lockedCount); setHasMore(d.hasMore); setNextOffset(d.nextOffset); setError(null) })
      .catch(() => { if (!alive) return; setItems([]); setHasMore(false); setError(t('loadFailed')) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.key, subject, category, remote, involvement, t])
  const more = async () => {
    setLoadingMore(true)
    try {
      const d = await apiFetch<{ cases: SupportCaseItem[]; lockedCount: number; hasMore: boolean; nextOffset: number }>(query(nextOffset))
      setItems((prev) => [...(prev ?? []), ...d.cases.filter((c) => !c.locked)])
      setLockedCount((n) => n + d.lockedCount)
      setHasMore(d.hasMore)
      setNextOffset(d.nextOffset)
    } catch {
      setError(t('loadFailed'))
    } finally {
      setLoadingMore(false)
    }
  }

  const subjects = current ? areaSubjectsForFace(current.kind) : []
  const filterSummary = [
    subject ? t(`subject${subject}`) : t('subjectAll'),
    subject && category ? tSdgs(`area.${subject}.${category}`) : null,
    remote ? t('remoteShort') : null,
    involvement === 'notOffered' ? t('notOffered') : involvement === 'mine' ? t('mine') : t('everything'),
  ].filter(Boolean).join(' ・ ')
  // 顔を替えて、選んでいた種類がその顔で選べなくなったら外す
  useEffect(() => {
    if (subject && current && !areaSubjectsForFace(current.kind).includes(subject)) { setSubject(null); setCategory(null) }
  }, [current, subject])

  // 支える側の顔がまだない人には、白い画面でなく登録への道を出す(支えるホームと同じ)
  if (options.length === 0) {
    return (
      <Card tone="support" className="flex flex-col gap-3 p-4">
        <Lead>{tHome('noFace')}</Lead>
        <Link href="/support/join" className="text-t15 font-bold text-night">{tHome('join')}</Link>
      </Card>
    )
  }
  return (
    <>
      <FacePicker options={options} current={current} onChoose={choose} />
      <div className="flex items-center justify-between">
        <Heading level={2}>{t('title')}</Heading>
        <Tip label={t('tipLabel')}>{t('tip')}</Tip>
      </div>
      {current?.kind === 'INDIVIDUAL' && <Card tone="support" className="p-3"><Lead>{t('individualNote')}</Lead></Card>}
      {/* 絞り込みは1つのボタンにまとめ、開いたときだけ出す(縦に積むと最初の結果まで遠い。画面の見直し 所見 9)。
          閉じているときも、いまの絞り込みをボタンの中に書く */}
      <Card tone="support" className="flex flex-col px-4 py-1">
        <button
          type="button"
          aria-expanded={filtersOpen}
          aria-controls="find-filters"
          onClick={() => setFiltersOpen((v) => !v)}
          className="flex min-h-[48px] items-center justify-between gap-3 text-left"
        >
          <span className="flex min-w-0 flex-col">
            <span className="text-t13 font-bold">{t('filters')}</span>
            <span className="truncate text-t12_5 text-ink-soft">{filterSummary}</span>
          </span>
          <span aria-hidden className={filtersOpen ? 'rotate-180 text-mist' : 'text-mist'}>⌄</span>
        </button>
        {filtersOpen && (
          <div id="find-filters" className="flex flex-col gap-3 border-t border-line pb-3 pt-3">
            {/* 大項目は選ぶ形にする(札を並べるとスマホで何段にも折り返し、横に流すと右端が切れて見えるため。AGENTS.md) */}
      <label className="flex flex-col gap-1.5">
        <span className="text-t13 font-bold">{t('subject')}</span>
        <select
          value={subject ?? ''}
          onChange={(e) => { setSubject(subjects.find((x) => x === e.target.value) ?? null); setCategory(null) }}
          className="min-h-[48px] rounded-tool border-[1.5px] border-line-strong bg-paper px-3 text-t16"
        >
          <option value="">{t('subjectAll')}</option>
          {subjects.map((s) => <option key={s} value={s}>{t(`subject${s}`)}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-t13 font-bold">{t('category')}</span>
        <select
          value={category ?? ''}
          disabled={!subject}
          onChange={(e) => setCategory(e.target.value ? Number(e.target.value) : null)}
          className="min-h-[48px] rounded-tool border-[1.5px] border-line-strong bg-paper px-3 text-t16 disabled:text-mist"
        >
          <option value="">{t('all')}</option>
          {subject && AREA_GOALS[subject].map((g) => <option key={g} value={g}>{tSdgs(`area.${subject}.${g}`)}</option>)}
        </select>
        {!subject && <span className="text-t12 text-mist">{t('categoryNeedsSubject')}</span>}
      </label>
            <div className="flex flex-col">
        <Toggle checked={remote} onChange={setRemote} label={t('remote')} description={t('remoteNote')} />
        <label className="flex min-h-[48px] items-center justify-between gap-3 text-t14 font-bold">
          {t('involvement')}
          <select value={involvement} onChange={(e) => setInvolvement(e.target.value === 'mine' ? 'mine' : e.target.value === 'all' ? 'all' : 'notOffered')} className="min-h-[40px] rounded-tool border border-line-strong bg-paper px-2 text-t14 font-normal">
            <option value="notOffered">{t('notOffered')}</option>
            <option value="mine">{t('mine')}</option>
            <option value="all">{t('everything')}</option>
          </select>
        </label>
            </div>
          </div>
        )}
      </Card>
      {lockedCount > 0 && <Card tone="support" className="bg-lamp-faint p-3"><Lead>{t('locked', { count: lockedCount })}</Lead></Card>}
      {error && <Lead>{error}</Lead>}
      {items && <span className="px-1 text-t12_5 text-mist">{t('count', { count: items.length })}</span>}
      {(items ?? []).map((c) => <CaseCard key={c.id} item={c} face={current?.key ?? ''} />)}
      {hasMore && items && (
        <Button tone="support" variant="outline" disabled={loadingMore} onClick={() => void more()}>{loadingMore ? t('loadingMore') : t('loadMore')}</Button>
      )}
    </>
  )
}

export default function FindPage() {
  return (
    <RequireMe>
      {() => <AppFrame tone="support"><Find /></AppFrame>}
    </RequireMe>
  )
}

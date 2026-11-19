import 'server-only'

// 相談に合う支援団体の提案(#138)を作って残し、読み出す。
// 届けた直後に応答のあと(after)で作り、画面を開いたときにまだ無ければその場で作る。毎日の処理も抜けを拾う。
// 候補の絞り込みと並べ方は src/lib/domain/suggestions.ts、AI のプロンプトは src/lib/ai/prompts/suggestOrganizations.ts。
// 相談文は maskPii で伏せ、fenceConsultation で囲んでから渡す(AGENTS.md)。AI は generateJson だけから呼ぶ。
import { generateJson } from '@/lib/ai/client'
import { fenceConsultation } from '@/lib/aiSafety'
import { maskPii } from '@/lib/pii'
import { supabaseAdmin } from '@/lib/supabase/server'
import { caseBodyForAi, type SubjectType } from '@/lib/domain/intake'
import {
  AI_CANDIDATE_LIMIT,
  NON_MUNICIPAL_PUBLIC_CATEGORIES,
  goalsOf,
  pickSuggestions,
  rankCandidates,
  type RankedCandidate,
  type Suggestion,
  type SuggestCandidate,
  type SuggestCase,
} from '@/lib/domain/suggestions'
import { buildSuggestPrompt, parseSuggestPicks } from '@/lib/ai/prompts/suggestOrganizations'
import { AFTER_RESPONSE_AI_TIMEOUT_MS } from './caseAi'

const CANDIDATE_COLUMNS = 'id, kind, categories, name, prefecture_code, service_scope, service_codes, accepts_consultation, claim_status, org_type, consult_indicators, sdgs_goals, consult_targets, consult_subjects, consult_channels, consult_summary'
// 1 回の問い合わせで拾う候補の上限(決まりで並べ直す前)
const FETCH_LIMIT = 300

type CandidateRow = {
  id: string
  kind: string
  categories: string[]
  name: string
  prefecture_code: string | null
  service_scope: string
  service_codes: string[]
  accepts_consultation: string
  claim_status: string
  org_type: string | null
  consult_indicators: string[]
  sdgs_goals: number[]
  consult_targets: string[]
  consult_subjects: string[]
  consult_channels: string[]
  consult_summary: string | null
}

type CaseRow = {
  id: string
  status: string
  subject_type: SubjectType
  region_country: string | null
  region_code: string | null
  intake_qna: { indicators?: string[]; since?: string | null; wish?: string | null } | null
  is_minor: boolean | null
  urgency: string | null
  description_free: string | null
  locale: string | null
  suggestions_generated_at: string | null
}

function toCandidate(r: CandidateRow): SuggestCandidate {
  return {
    id: r.id,
    kind: r.kind,
    categories: r.categories ?? [],
    name: r.name,
    prefectureCode: r.prefecture_code,
    serviceScope: r.service_scope,
    serviceCodes: r.service_codes ?? [],
    acceptsConsultation: r.accepts_consultation,
    claimStatus: r.claim_status,
    orgType: r.org_type,
    indicators: r.consult_indicators ?? [],
    sdgsGoals: r.sdgs_goals ?? [],
    targets: r.consult_targets ?? [],
    subjects: r.consult_subjects ?? [],
    channels: r.consult_channels ?? [],
  }
}

// 地域の条件(全国・相談の都道府県)。都道府県で受けている団体は prefecture_code か service_codes に入っている
function regionFilter(regionCode: string | null): string {
  if (!regionCode || !/^JP-\d{2}$/.test(regionCode)) return 'service_scope.eq.NATIONWIDE'
  return `service_scope.eq.NATIONWIDE,prefecture_code.eq.${regionCode},service_codes.cs.{${regionCode}}`
}

async function fetchCandidates(k: SuggestCase): Promise<CandidateRow[]> {
  const base = () => supabaseAdmin.from('directory_entries').select(CANDIDATE_COLUMNS).eq('visibility', 'PUBLIC').or(regionFilter(k.regionCode))
  const goals = goalsOf(k.indicators)
  const queries = [
    // 指標が重なる民間の団体
    k.indicators.length > 0
      ? base().eq('kind', 'ORGANIZATION').eq('accepts_consultation', 'YES').neq('claim_status', 'CLAIMED').overlaps('consult_indicators', k.indicators).limit(FETCH_LIMIT)
      : null,
    // 大項目が重なる民間の団体(指標の重なりが少ないとき用)
    goals.length > 0
      ? base().eq('kind', 'ORGANIZATION').eq('accepts_consultation', 'YES').neq('claim_status', 'CLAIMED').overlaps('sdgs_goals', goals).limit(FETCH_LIMIT)
      : null,
    // 足りないときに埋める、自治体でない公的な窓口(事業者向けの全国の電話窓口を含む)
    base().in('kind', ['PUBLIC_WINDOW', 'NATIONAL_HOTLINE']).overlaps('categories', [...NON_MUNICIPAL_PUBLIC_CATEGORIES]).limit(50),
    // 緊急と判定した相談では、全国の電話窓口も AI に見せる
    k.urgent ? base().eq('kind', 'NATIONAL_HOTLINE').limit(50) : null,
  ]
  const results = await Promise.all(queries.map((q) => q ?? Promise.resolve({ data: [], error: null })))
  const failed = results.find((r) => r.error)
  if (failed?.error) throw failed.error
  return results.flatMap((r) => (r.data ?? []) as CandidateRow[])
}

// 相談の条件と本文から提案を選ぶ(DB は読むだけ)。相談を保存せずに提案の質を確かめるときもこれを呼ぶ
export async function computeSuggestions(k: SuggestCase, body: string, locale: string): Promise<{ picks: Suggestion[]; ranked: RankedCandidate[]; aiUsed: boolean }> {
  const rows = await fetchCandidates(k)
  const byId = new Map(rows.map((r) => [r.id, r]))
  const ranked = rankCandidates(rows.map(toCandidate), k)

  let aiPicks: { id: string; reason: string | null }[] | null = null
  // 民間・公的な窓口の上位に、緊急の電話窓口(あれば全部)を足して AI に見せる
  const forAi = [...ranked.filter((r) => r.tier !== 'HOTLINE').slice(0, AI_CANDIDATE_LIMIT), ...ranked.filter((r) => r.tier === 'HOTLINE')]
  // 民間の団体か緊急の電話窓口があるときだけ AI に見比べさせる(公的な窓口だけなら決まりの並びで足りる)
  if (forAi.some((r) => r.tier !== 'PUBLIC')) {
    const prompt = buildSuggestPrompt({
      subject: k.subject,
      fencedText: fenceConsultation(maskPii(body)),
      locale,
      isMinor: k.isMinor,
      candidates: forAi.map((r) => ({
        id: r.candidate.id,
        name: r.candidate.name,
        summary: byId.get(r.candidate.id)?.consult_summary ?? null,
        targets: r.candidate.targets,
        channels: r.candidate.channels,
        area: r.tier === 'HOTLINE' ? '全国の電話窓口' : r.candidate.serviceScope === 'NATIONWIDE' ? '全国' : '相談と同じ都道府県',
      })),
    })
    const result = await generateJson('consultation', prompt, { temperature: 0, maxOutputTokens: 2048, timeoutMs: AFTER_RESPONSE_AI_TIMEOUT_MS })
    if (result.ok) aiPicks = parseSuggestPicks(result.json, new Set(forAi.map((r) => r.candidate.id)))
    else console.error(`[suggestions] AI unavailable (${result.code}); using rule order`)
  }
  return { picks: pickSuggestions(ranked, aiPicks), ranked, aiUsed: aiPicks !== null }
}

// 提案を作って残す。作った(0 件を含む)なら true、ほかの処理が先に作っていた・対象外なら false
export async function generateSuggestions(caseId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('cases')
    .select('id, status, subject_type, region_country, region_code, intake_qna, is_minor, urgency, description_free, locale, suggestions_generated_at')
    .eq('id', caseId)
    .single()
  if (error) throw error
  const c = data as CaseRow
  if (c.suggestions_generated_at || c.status !== 'OPEN') return false

  const { picks } = await computeSuggestions(
    { subject: c.subject_type, regionCountry: c.region_country, regionCode: c.region_code, indicators: c.intake_qna?.indicators ?? [], isMinor: c.is_minor === true, urgent: c.urgency === 'High' },
    caseBodyForAi({ description: c.description_free ?? '', since: c.intake_qna?.since, wish: c.intake_qna?.wish }),
    c.locale ?? 'ja',
  )

  // 先に作り終えた印を付けた処理だけが書き込む(届けた直後の after と画面を開いたときが重なっても二重にしない)
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from('cases')
    .update({ suggestions_generated_at: new Date().toISOString() })
    .eq('id', caseId)
    .is('suggestions_generated_at', null)
    .select('id')
    .maybeSingle()
  if (claimError) throw claimError
  if (!claimed) return false
  if (picks.length > 0) {
    const { error: insertError } = await supabaseAdmin.from('case_suggestions').insert(
      picks.map((p) => ({ case_id: caseId, directory_entry_id: p.id, rank: p.rank, reason: p.reason, method: p.method })),
    )
    if (insertError) throw insertError
  }
  return true
}

// 提案が 0 件だった受付中の相談を作り直す(掲載台帳の団体はあとから増えるため)。作り直したら true。
// 前に作ってから minAgeMs 経ったものだけ。0 件でなければ何もしない
export async function regenerateEmptySuggestions(caseId: string, minAgeMs: number): Promise<boolean> {
  const { count, error } = await supabaseAdmin.from('case_suggestions').select('case_id', { count: 'exact', head: true }).eq('case_id', caseId)
  if (error) throw error
  if ((count ?? 0) > 0) return false
  const { data: reset, error: resetError } = await supabaseAdmin
    .from('cases')
    .update({ suggestions_generated_at: null })
    .eq('id', caseId)
    .eq('status', 'OPEN')
    .lt('suggestions_generated_at', new Date(Date.now() - minAgeMs).toISOString())
    .select('id')
    .maybeSingle()
  if (resetError) throw resetError
  if (!reset) return false
  return generateSuggestions(caseId)
}

export type SavedSuggestion = {
  rank: number
  reason: string | null
  method: string
  entry: {
    id: string
    kind: string
    name: string
    phone: string | null
    website_url: string | null
    hours_text: string | null
    consult_summary: string | null
    consult_channels: string[]
    verification_status: string
    claim_status: string
    attribution: string | null
    source_url: string
  } | null
}

export async function loadSuggestions(caseId: string): Promise<SavedSuggestion[]> {
  const { data, error } = await supabaseAdmin
    .from('case_suggestions')
    .select('rank, reason, method, entry:directory_entries(id, kind, name, phone, website_url, hours_text, consult_summary, consult_channels, verification_status, claim_status, attribution, source_url)')
    .eq('case_id', caseId)
    .order('rank', { ascending: true })
  if (error) throw error
  // 型の上では埋め込みが並びになるが、多対一なので実際は 1 行(どちらでも読めるようにする)
  return (data ?? []).map((r): SavedSuggestion => ({
    rank: r.rank,
    reason: r.reason ?? null,
    method: r.method,
    entry: (Array.isArray(r.entry) ? r.entry[0] : r.entry) ?? null,
  }))
}

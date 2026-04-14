// src/app/supporter/dashboard/page.tsx
'use client';
import { isMinor } from '@/lib/utils/age'

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SDG_COLORS, SDG_NAMES, CASE_STATUS, REGION_BLOCKS, formatRelativeDate, SUPPORTER_BADGES, BadgeKey } from '@/lib/constants/sdgs';

type Case = {
  id: string;
  title: string;
  description_free: string;
  urgency: string;
  status: string;
  created_at: string;
  region_country: string;
  region_area: string | null;
  owner_user_id: string;
  ai_sdg_suggestion: {
    sdgs_goals: number[];
    reasoning: string;
    keywords: string[];
  } | null;
  users?: {
    display_name: string;
    prefecture?: string | null;
    birth_date?: string | null;
  };
  my_offer_status?: string | null;
};

type UserData = {
  id: string;
  display_name: string;
  organization_name: string | null;
  role: string;
  service_area_nationwide?: boolean;
  service_areas?: Array<{ region_code: string; name_local: string; name_en: string }>;
  parent_supporter_id?: string | null;
  is_sub_account?: boolean;
};

function SupporterCaseCard({ case_, showUser = true, onClick }: { case_: Case; showUser?: boolean; onClick: () => void; }) {
  const sdgs = case_.ai_sdg_suggestion?.sdgs_goals || [];
  const keywords = case_.ai_sdg_suggestion?.keywords || [];
  const engagement = case_.my_offer_status || 'none';
  const engConfig: Record<string, { label: string; color: string; icon: string; border: string }> = {
    none: { label: '未対応', color: 'bg-slate-100 text-slate-500', icon: '○', border: 'border-l-slate-300' },
    PENDING: { label: '申し出中', color: 'bg-amber-50 text-amber-600', icon: '⏳', border: 'border-l-amber-400' },
    ACCEPTED: { label: '承認済み', color: 'bg-teal-50 text-teal-600', icon: '✅', border: 'border-l-teal-500' },
    WITHDRAWN: { label: '取り下げ済', color: 'bg-gray-100 text-gray-400', icon: '↩', border: 'border-l-gray-300' },
    DECLINED: { label: '辞退', color: 'bg-gray-100 text-gray-400', icon: '✕', border: 'border-l-gray-300' },
  };
  const caseStatusOverride: Record<string, { label: string; color: string; icon: string; border: string }> = {
    MATCHED: { label: 'マッチ済み・支援中', color: 'bg-amber-50 text-amber-600', icon: '🤝', border: 'border-l-amber-400' },
    RESOLVED: { label: '解決済み', color: 'bg-teal-50 text-teal-700', icon: '✅', border: 'border-l-teal-500' },
    CANCELLED: { label: '取消済み', color: 'bg-gray-100 text-gray-400', icon: '✕', border: 'border-l-gray-300' },
    CLOSED: { label: '終了', color: 'bg-gray-100 text-gray-400', icon: '📁', border: 'border-l-gray-300' },
  };
  const eng = (engagement === 'ACCEPTED' && caseStatusOverride[case_.status]) ? caseStatusOverride[case_.status] : engConfig[engagement] || engConfig.none;

  return (
    <Card className={`border-l-4 ${eng.border} hover:shadow-md transition-all cursor-pointer`} onClick={onClick}>
      <CardContent className="p-5">
        <div className="flex justify-between items-start mb-2 gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-[15px] font-bold text-gray-800 leading-snug truncate">{case_.title}</h3>
            {showUser && case_.users && <span className="text-xs text-gray-500">👤 {case_.users.display_name}</span>}
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${eng.color}`}>{eng.icon} {eng.label}</span>
            {case_.urgency === 'High' && <span className="text-[11px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded">🔴 緊急</span>}
            {isMinor(case_.users?.birth_date) && (
              <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                🔰 未成年
              </span>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-500 line-clamp-2 mb-2">{case_.description_free}</p>
        <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
          <div className="flex gap-1 flex-wrap">
            {keywords.slice(0, 3).map((kw) => <span key={kw} className="text-[11px] px-2 py-0.5 bg-gray-100 rounded text-gray-500">#{kw}</span>)}
          </div>
          <div className="flex gap-1">
            {sdgs.map((g) => <span key={g} className="w-5 h-5 rounded text-white text-[10px] font-bold flex items-center justify-center" style={{ backgroundColor: SDG_COLORS[g] }} title={SDG_NAMES[g]}>{g}</span>)}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-gray-400">📅 {formatRelativeDate(case_.created_at)}</span>
          <Button size="sm" variant="outline" className="text-xs h-7" onClick={(e) => { e.stopPropagation(); onClick(); }}>
            {engagement === 'none' ? '💬 詳細・申し出' : '詳細を見る'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function UserGroupedView({ cases, onCaseClick }: { cases: Case[]; onCaseClick: (id: string) => void; }) {
  const grouped: Record<string, { userName: string; items: Case[]; sdgs: Set<number> }> = {};
  cases.forEach((c) => {
    const uid = c.owner_user_id;
    if (!grouped[uid]) grouped[uid] = { userName: c.users?.display_name || '不明', items: [], sdgs: new Set() };
    grouped[uid].items.push(c);
    (c.ai_sdg_suggestion?.sdgs_goals || []).forEach((s) => grouped[uid].sdgs.add(s));
  });
  return (
    <div className="space-y-5">
      {Object.entries(grouped).map(([uid, group]) => (
        <div key={uid} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-gray-50 to-blue-50/30 px-5 py-3 border-b border-gray-100 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold">{group.userName.charAt(group.userName.length - 1)}</div>
              <div>
                <span className="text-sm font-bold text-gray-800">👤 {group.userName}</span>
                <div className="text-xs text-gray-500">相談 {group.items.length}件</div>
              </div>
            </div>
            <div className="flex gap-1">
              {[...group.sdgs].sort((a, b) => a - b).map((s) => <span key={s} className="w-6 h-6 rounded text-white text-[10px] font-bold flex items-center justify-center" style={{ backgroundColor: SDG_COLORS[s] }}>{s}</span>)}
            </div>
          </div>
          <div className="p-3 space-y-2">
            {group.items.map((c) => <SupporterCaseCard key={c.id} case_={c} showUser={false} onClick={() => onCaseClick(c.id)} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function RegionFilterDropdown({ allRegions, activityRegions, regionFilter, setRegionFilter, getCaseCount }: { allRegions: string[]; activityRegions: string[]; regionFilter: string | null; setRegionFilter: (v: string | null) => void; getCaseCount: (r: string) => number; }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const otherRegions = allRegions.filter((r) => !activityRegions.includes(r));
  const otherCount = otherRegions.reduce((sum, r) => sum + getCaseCount(r), 0);
  const isOtherSelected = regionFilter && !activityRegions.includes(regionFilter);
  return (
    <div className="flex gap-1.5 flex-wrap items-center relative" ref={ref}>
      <span className="text-[11px] text-gray-400 font-semibold mr-0.5">📍 地域:</span>
      <button onClick={() => { setRegionFilter(null); setOpen(false); }} className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${regionFilter === null ? 'border-indigo-400 bg-indigo-50 text-indigo-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>すべて</button>
      {activityRegions.map((r) => { const count = getCaseCount(r); if (count === 0) return null; return <button key={r} onClick={() => { setRegionFilter(regionFilter === r ? null : r); setOpen(false); }} className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${regionFilter === r ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-indigo-200 bg-indigo-50 text-indigo-600'}`}>📍 {r} ({count})</button>; })}
      {otherRegions.length > 0 && (
        <>
          <button onClick={() => setOpen(!open)} className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1 transition-colors ${isOtherSelected || open ? 'border-indigo-400 bg-indigo-50 text-indigo-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
            {isOtherSelected ? `📍 ${regionFilter}` : `活動地域外 ${otherRegions.length}地域`}
            {!isOtherSelected && otherCount > 0 && <span className="text-gray-400">({otherCount})</span>}
            <span className={`text-[10px] transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
          </button>
          {open && (
            <div className="absolute top-full left-14 mt-1 z-50 bg-white rounded-xl border border-gray-200 shadow-xl p-4 min-w-[300px] max-w-[400px] max-h-[340px] overflow-y-auto">
              <div className="text-xs font-bold text-gray-700 mb-1">活動地域外からの相談</div>
              <div className="text-[11px] text-gray-400 mb-3">あなたの活動地域（{activityRegions.join("・")}）以外から届いている相談です</div>
              {Object.entries(REGION_BLOCKS).map(([blockName, prefectures]) => {
                const active = prefectures.filter((p) => otherRegions.includes(p));
                if (active.length === 0) return null;
                return (
                  <div key={blockName} className="mb-3">
                    <div className="text-[11px] font-semibold text-gray-400 mb-1">{blockName}</div>
                    <div className="flex gap-1.5 flex-wrap">
                      {active.map((p) => <button key={p} onClick={() => { setRegionFilter(regionFilter === p ? null : p); setOpen(false); }} className={`px-2.5 py-0.5 rounded-full text-xs border transition-colors ${regionFilter === p ? 'border-indigo-400 bg-indigo-50 text-indigo-600' : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>📍 {p} <span className="text-gray-400">({getCaseCount(p)})</span></button>)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function SupporterDashboard() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sdgFilter, setSdgFilter] = useState<number | null>(null);
  const [engagementFilter, setEngagementFilter] = useState<string | null>(null);
  const [regionFilter, setRegionFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'flat' | 'grouped'>('flat');
  const [badgeCounts, setBadgeCounts] = useState<Record<string, number>>({});
  // メンバー管理
  const [members, setMembers] = useState<Array<{ id: string; real_name: string; email: string; display_id: string; member_approved_at: string }>>([]);
  const [memberMax, setMemberMax] = useState(5);
  const [showMemberPanel, setShowMemberPanel] = useState(false);
  const [memberForm, setMemberForm] = useState({ email: '', real_name: '' });
  const [memberLoading, setMemberLoading] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [newMemberPassword, setNewMemberPassword] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      // API経由でロール確認（RLSをバイパス）
      const roleRes = await fetch('/api/auth/get-role', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      // 停止済みアカウントは強制ログアウト
      if (roleRes.status === 403) {
        await supabase.auth.signOut();
        router.push('/login?reason=suspended');
        return;
      }

      const roleData = await roleRes.json();
      if (roleData.role !== 'SUPPORTER') { router.push('/'); return; }
      if (!roleData.user) { router.push('/'); return; }

      // 活動地域は専用APIから直接取得（確実に最新データを得るため）
      const [dashRes, areaRes] = await Promise.all([
        fetch('/api/supporter/dashboard', {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        }),
        fetch('/api/supporter/service-areas', {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        }),
      ]);

      // ユーザーデータに活動地域を上書きマージ
      const userDataWithAreas = { ...roleData.user };
      if (areaRes.ok) {
        const areaData = await areaRes.json();
        userDataWithAreas.service_areas = areaData.service_areas || [];
        userDataWithAreas.service_area_nationwide = areaData.service_area_nationwide || false;
      }
      setUserData(userDataWithAreas);
      setAccessToken(session.access_token);

      // 親アカウントの場合はメンバー一覧も取得
      if (!roleData.user.parent_supporter_id) {
        const memberRes = await fetch('/api/supporter/members', {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        });
        if (memberRes.ok) {
          const memberData = await memberRes.json();
          setMembers(memberData.members ?? []);
          setMemberMax(memberData.max ?? 5);
        }
      }

      // API経由で案件・オファー・バッジを一括取得（RLSバイパス）
      if (dashRes.ok) {
        const { cases: enriched, badgeCounts } = await dashRes.json();
        setCases(enriched || []);
        setBadgeCounts(badgeCounts || {});
      }

      setIsLoading(false);
    };
    loadData();
  }, [router]);

  // ── メンバー追加 ──
  const handleAddMember = async () => {
    if (!memberForm.email || !memberForm.real_name) {
      setMemberError('メールアドレスと氏名を入力してください');
      return;
    }
    setMemberLoading(true);
    setMemberError(null);
    setNewMemberPassword(null);
    try {
      const res = await fetch('/api/supporter/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify(memberForm),
      });
      const data = await res.json();
      if (!res.ok) { setMemberError(data.error ?? '追加に失敗しました'); return; }
      setMembers(prev => [...prev, data.member]);
      setMemberForm({ email: '', real_name: '' });
      if (data.tempPassword) setNewMemberPassword(data.tempPassword);
    } catch (err) {
      console.error('[handleAddMember] error:', err);
      setMemberError('エラーが発生しました: ' + (err instanceof Error ? err.message : String(err)));
    }
    finally { setMemberLoading(false); }
  };

  // ── メンバー削除 ──
  const handleDeleteMember = async (memberId: string) => {
    if (!confirm('このメンバーを削除しますか？')) return;
    try {
      const res = await fetch('/api/supporter/members', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({ memberId }),
      });
      if (!res.ok) { alert('削除に失敗しました'); return; }
      setMembers(prev => prev.filter(m => m.id !== memberId));
    } catch { alert('エラーが発生しました'); }
  };



  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">読み込み中...</p></div>;

  const getCaseDisplayStatus = (c: Case): string => {
    if (!c.my_offer_status) return 'none';
    if (c.my_offer_status === 'PENDING') return 'pending';
    if (c.my_offer_status === 'ACCEPTED') { if (c.status === 'RESOLVED' || c.status === 'CLOSED') return 'resolved'; return 'active'; }
    return 'other';
  };

  const filteredCases = cases.filter((c) => {
    if (sdgFilter && !(c.ai_sdg_suggestion?.sdgs_goals || []).includes(sdgFilter)) return false;
    if (engagementFilter && getCaseDisplayStatus(c) !== engagementFilter) return false;
    if (regionFilter && c.users?.prefecture !== regionFilter) return false;
    return true;
  });

  const allSdgs = [...new Set(cases.flatMap((c) => c.ai_sdg_suggestion?.sdgs_goals || []))].sort((a, b) => a - b);
  const allRegions = [...new Set(cases.map((c) => c.users?.prefecture).filter(Boolean) as string[])].sort();
  const activityRegions = (userData?.service_areas || []).map((a) => a.name_local);
  const getCaseCount = (r: string) => cases.filter((c) => c.users?.prefecture === r).length;
  const stats = [
    { label: '相談件数', value: cases.length, color: 'text-blue-600' },
    { label: 'マッチ済み・支援中', value: cases.filter((c) => getCaseDisplayStatus(c) === 'active').length, color: 'text-amber-600' },
    { label: '解決済み', value: cases.filter((c) => getCaseDisplayStatus(c) === 'resolved').length, color: 'text-teal-600' },
    { label: '緊急案件', value: cases.filter((c) => c.urgency === 'High').length, color: 'text-red-500' },
  ];
  const clearFilters = () => { setSdgFilter(null); setEngagementFilter(null); setRegionFilter(null); };
  const hasActiveFilter = sdgFilter || engagementFilter || regionFilter;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">こんにちは、{userData?.organization_name || userData?.display_name} さん 👋</h1>
              <p className="text-gray-500 mt-1">支援を必要としている方々の相談を確認できます</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <a href="/profile"
                className="flex items-center gap-1.5 text-xs text-gray-600 bg-white border border-gray-200 hover:border-teal-400 hover:text-teal-600 px-3 py-2 rounded-xl transition-colors shadow-sm">
                ✏️ プロフィール編集
              </a>
              <a href="/contact"
                className="flex items-center gap-1.5 text-xs text-gray-600 bg-white border border-gray-200 hover:border-teal-400 hover:text-teal-600 px-3 py-2 rounded-xl transition-colors shadow-sm">
                📩 お問い合わせ
              </a>
            </div>
          </div>
          <div className="mt-3 flex items-start gap-2">
            <span className="text-sm text-gray-600 flex-shrink-0">📍 活動地域:</span>
            {userData?.service_area_nationwide ? (
              <span className="text-sm font-medium text-blue-600">全国対応</span>
            ) : activityRegions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {activityRegions.map((r, i) => <span key={i} className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-200">{r}</span>)}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm text-orange-600">未設定</span>
                <a href="/profile" className="text-xs text-blue-600 hover:underline">→ 設定する</a>
              </div>
            )}
          </div>
        </div>

        {/* ── メンバー管理パネル（親アカウントのみ表示） ── */}
        {!userData?.is_sub_account && (
          <div className="mb-6 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button
              onClick={() => setShowMemberPanel(p => !p)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-base">👥</span>
                <span className="font-medium text-gray-800 text-sm">所属メンバー管理</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  members.length >= memberMax ? 'bg-red-100 text-red-600' : 'bg-teal-100 text-teal-700'
                }`}>{members.length} / {memberMax}名</span>
              </div>
              <span className="text-gray-400 text-xs">{showMemberPanel ? '▲ 閉じる' : '▼ 開く'}</span>
            </button>

            {showMemberPanel && (
              <div className="px-5 pb-5">
                {/* メンバー一覧 */}
                {members.length > 0 && (
                  <div className="mb-4 space-y-2">
                    {members.map(m => (
                      <div key={m.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{m.real_name}</p>
                          <p className="text-xs text-gray-400">{m.email}　<span className="text-gray-300">|</span>　{m.display_id}</p>
                        </div>
                        <button
                          onClick={() => handleDeleteMember(m.id)}
                          className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          削除
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {members.length === 0 && (
                  <p className="text-sm text-gray-400 mb-4">まだメンバーがいません</p>
                )}

                {/* 追加フォーム */}
                {members.length < memberMax ? (
                  <div className="border border-dashed border-gray-200 rounded-xl p-4">
                    <p className="text-xs font-medium text-gray-600 mb-3">メンバーを追加</p>
                    <div className="space-y-2 mb-3">
                      <input
                        type="text"
                        placeholder="氏名"
                        value={memberForm.real_name}
                        onChange={e => setMemberForm(p => ({ ...p, real_name: e.target.value }))}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-300"
                      />
                      <input
                        type="email"
                        placeholder="メールアドレス"
                        value={memberForm.email}
                        onChange={e => setMemberForm(p => ({ ...p, email: e.target.value }))}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-300"
                      />
                    </div>
                    {memberError && (
                      <p className="text-xs text-red-600 mb-2">{memberError}</p>
                    )}
                    <button
                      onClick={handleAddMember}
                      disabled={memberLoading}
                      className="w-full bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {memberLoading ? '追加中...' : '＋ 追加する'}
                    </button>
                    <p className="text-xs text-gray-400 mt-2">※ 新規メンバーには初期パスワードが発行されます（初回ログイン時に変更必須）</p>
                  </div>
                ) : (
                  <p className="text-xs text-red-500 text-center py-2">上限（{memberMax}名）に達しています</p>
                )}

                {/* 初期パスワード表示 */}
                {newMemberPassword && (
                  <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-xs font-medium text-amber-800 mb-1">⚠️ 初期パスワード（一度のみ表示）</p>
                    <p className="font-mono text-sm text-amber-900 bg-white px-3 py-2 rounded-lg border border-amber-200 break-all">{newMemberPassword}</p>
                    <p className="text-xs text-amber-600 mt-2">このパスワードをメンバーに安全な方法で伝えてください。初回ログイン後に変更が必要です。</p>
                    <button onClick={() => setNewMemberPassword(null)} className="text-xs text-amber-600 hover:text-amber-800 mt-2 underline">閉じる</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* サブアカウントの場合：所属団体を表示 */}
        {userData?.is_sub_account && (
          <div className="mb-6 bg-teal-50 border border-teal-200 rounded-xl px-5 py-3 text-sm text-teal-800">
            👥 あなたは <span className="font-medium">{userData.organization_name}</span> のメンバーとしてログインしています
          </div>
        )}

        <div className="grid grid-cols-4 gap-3 mb-6">
          {stats.map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
              <div className="text-[11px] text-gray-400 mb-1">{s.label}</div>
              <div className={`text-xl font-extrabold ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {Object.keys(badgeCounts).length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-semibold text-gray-700">🏆 いただいた評価</span>
              <span className="text-xs text-gray-400">合計 {Object.values(badgeCounts).reduce((a, b) => a + b, 0)}件</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {(Object.keys(SUPPORTER_BADGES) as BadgeKey[]).map((key) => {
                const count = badgeCounts[key] || 0;
                if (count === 0) return null;
                const badge = SUPPORTER_BADGES[key];
                return (
                  <div key={key} className="flex items-center gap-1.5 bg-gray-50 hover:bg-gray-100 transition-colors rounded-full px-3 py-1.5 border border-gray-200" title={badge.label}>
                    <span className="text-lg">{badge.emoji}</span>
                    <span className="text-sm font-bold text-gray-700">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-gray-700">🎯 SOS案件フィルター</span>
            <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
              {([{ id: 'flat', label: '📋 案件' }, { id: 'grouped', label: '👥 ユーザー' }] as const).map((v) => (
                <button key={v.id} onClick={() => setViewMode(v.id)} className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${viewMode === v.id ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>{v.label}</button>
              ))}
            </div>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => setSdgFilter(null)} className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${sdgFilter === null ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-500'}`}>すべて ({cases.length})</button>
            {allSdgs.map((s) => {
              const count = cases.filter((c) => (c.ai_sdg_suggestion?.sdgs_goals || []).includes(s)).length;
              return <button key={s} onClick={() => setSdgFilter(sdgFilter === s ? null : s)} className="px-3 py-1 rounded-full text-xs font-semibold transition-colors" style={{ backgroundColor: sdgFilter === s ? SDG_COLORS[s] : SDG_COLORS[s] + '20', color: sdgFilter === s ? '#fff' : SDG_COLORS[s] }}>SDG {s} ({count})</button>;
            })}
          </div>
          {allRegions.length > 0 && <RegionFilterDropdown allRegions={allRegions} activityRegions={activityRegions} regionFilter={regionFilter} setRegionFilter={setRegionFilter} getCaseCount={getCaseCount} />}
          <div className="flex gap-1.5 flex-wrap">
            {[
              { key: null, label: '全ステータス', color: 'border-gray-300 bg-gray-50 text-gray-600' },
              { key: 'none', label: '○ 未対応', color: 'border-slate-300 bg-slate-50 text-slate-600' },
              { key: 'pending', label: '⏳ 申し出中', color: 'border-amber-300 bg-amber-50 text-amber-600' },
              { key: 'active', label: '🤝 マッチ済み・支援中', color: 'border-amber-300 bg-amber-50 text-amber-600' },
              { key: 'resolved', label: '✅ 解決済み', color: 'border-teal-300 bg-teal-50 text-teal-600' },
            ].map((f) => {
              const count = f.key === null ? cases.length : cases.filter((c) => getCaseDisplayStatus(c) === f.key).length;
              return <button key={f.key || 'all'} onClick={() => setEngagementFilter(engagementFilter === f.key ? null : f.key)} className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${engagementFilter === f.key ? f.color : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}>{f.label} ({count})</button>;
            })}
          </div>
        </div>

        <div className="flex justify-between items-center mb-3">
          <span className="text-sm text-gray-500">📋 {filteredCases.length}件 表示中{hasActiveFilter && <span className="text-gray-400"> / 全{cases.length}件</span>}</span>
          {hasActiveFilter && <button onClick={clearFilters} className="text-xs text-gray-500 border border-gray-200 rounded px-2.5 py-1 hover:bg-gray-50">✕ フィルターをクリア</button>}
        </div>

        {filteredCases.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-gray-700 font-semibold mb-1">該当する相談が見つかりません</p>
            <p className="text-sm text-gray-400 mb-4">フィルター条件を変更してみてください</p>
            <Button size="sm" onClick={clearFilters}>フィルターをリセット</Button>
          </div>
        ) : viewMode === 'flat' ? (
          <div className="space-y-3">
            {filteredCases.map((c) => <SupporterCaseCard key={c.id} case_={c} onClick={() => router.push(`/supporter/case/${c.id}`)} />)}
          </div>
        ) : (
          <UserGroupedView cases={filteredCases} onCaseClick={(id) => router.push(`/supporter/case/${id}`)} />
        )}
      </main>
    </div>
  );
}
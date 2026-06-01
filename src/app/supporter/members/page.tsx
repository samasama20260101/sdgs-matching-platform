'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronRight, KeyRound, Loader2, RotateCcw, Save, Shield, UserMinus, UserPlus, Users } from 'lucide-react';
import Header from '@/components/layout/Header';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type OrganizationRole = 'OWNER' | 'ADMIN' | 'MEMBER';
type MembershipStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'LEFT';

type Organization = {
  id: string;
  name: string;
  supporter_type: string | null;
  status: string;
};

type Member = {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrganizationRole;
  status: MembershipStatus;
  joined_at: string | null;
  left_at: string | null;
  created_at: string;
  department: string | null;
  external_phone: string | null;
  phone_extension: string | null;
  admin_note: string | null;
  user: {
    id: string;
    real_name: string;
    display_name: string;
    email: string;
    phone: string | null;
    is_suspended: boolean | null;
  } | null;
};

type MembersResponse = {
  organization: Organization;
  my_membership: {
    id: string;
    role: OrganizationRole;
  };
  members: Member[];
};
type MemberCreateResponse = {
  reused_existing_user?: boolean;
  member: Member;
};

type ApiErrorResponse = {
  error?: string;
  code?: 'ACCOUNT_SUSPENDED' | 'NO_ACTIVE_ORGANIZATION' | 'FORBIDDEN' | string;
};

const ROLE_LABEL: Record<OrganizationRole, string> = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
};

const ROLE_HELP: Record<OrganizationRole, string> = {
  OWNER: '団体管理',
  ADMIN: '担当者追加',
  MEMBER: '通常担当',
};

const STATUS_LABEL: Record<MembershipStatus, string> = {
  INVITED: '招待中',
  ACTIVE: '有効',
  SUSPENDED: '停止中',
  LEFT: '所属解除中',
};

const STATUS_CLASS: Record<MembershipStatus, string> = {
  INVITED: 'bg-amber-50 text-amber-700 border-amber-200',
  ACTIVE: 'bg-teal-50 text-teal-700 border-teal-200',
  SUSPENDED: 'bg-red-50 text-red-700 border-red-200',
  LEFT: 'bg-gray-100 text-gray-500 border-gray-200',
};

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const values = new Uint32Array(12);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => chars[value % chars.length]).join('');
}

export default function SupporterMembersPage() {
  const router = useRouter();
  const [data, setData] = useState<MembersResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionMemberId, setActionMemberId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [registrationType, setRegistrationType] = useState<'new' | 'existing'>('new');
  const [realName, setRealName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [externalPhone, setExternalPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [phoneExtension, setPhoneExtension] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [password, setPassword] = useState('');
  const [memberRole, setMemberRole] = useState<OrganizationRole>('MEMBER');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [detailDepartment, setDetailDepartment] = useState('');
  const [detailExternalPhone, setDetailExternalPhone] = useState('');
  const [detailPhoneExtension, setDetailPhoneExtension] = useState('');
  const [detailAdminNote, setDetailAdminNote] = useState('');

  const loadMembers = useCallback(async () => {
    setError(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/login');
      return;
    }

    try {
      const response = await fetch('/api/supporter/members', {
        cache: 'no-store',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({})) as ApiErrorResponse;
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        if (response.status === 403 && result.code === 'ACCOUNT_SUSPENDED') {
          await supabase.auth.signOut();
          router.push('/login?reason=suspended');
          return;
        }
        if (response.status === 403 && result.code === 'NO_ACTIVE_ORGANIZATION') {
          router.push('/supporter/no-organization');
          return;
        }
        throw new Error(result.error || 'メンバー情報の取得に失敗しました');
      }

      const result = await response.json() as MembersResponse;
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'メンバー情報の取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const myRole = data?.my_membership.role ?? 'MEMBER';
  const canAdd = myRole === 'OWNER' || myRole === 'ADMIN';
  const canManage = myRole === 'OWNER';
  const activeMembers = useMemo(
    () => data?.members.filter((member) => member.status === 'ACTIVE').length ?? 0,
    [data]
  );
  const currentMembers = useMemo(
    () => data?.members.filter((member) => member.status !== 'LEFT') ?? [],
    [data]
  );
  const leftMembers = useMemo(
    () => data?.members.filter((member) => member.status === 'LEFT') ?? [],
    [data]
  );
  const selectedMember = useMemo(
    () => data?.members.find((member) => member.id === selectedMemberId) ?? null,
    [data, selectedMemberId]
  );
  const canEditSelectedMember = !!selectedMember && (canManage || selectedMember.id === data?.my_membership.id);

  const openMemberDetails = (member: Member) => {
    setSelectedMemberId(member.id);
    setDetailDepartment(member.department || '');
    setDetailExternalPhone(member.external_phone || '');
    setDetailPhoneExtension(member.phone_extension || '');
    setDetailAdminNote(member.admin_note || '');
  };

  const handleAddMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('ログインが必要です');

      const response = await fetch('/api/supporter/members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email,
          registration_type: registrationType,
          ...(registrationType === 'new' ? {
            real_name: realName,
            display_name: displayName,
            external_phone: externalPhone,
            department,
            phone_extension: phoneExtension,
            admin_note: adminNote,
            password,
          } : {}),
          role: memberRole,
        }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({})) as ApiErrorResponse;
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        if (response.status === 403 && result.code === 'ACCOUNT_SUSPENDED') {
          await supabase.auth.signOut();
          router.push('/login?reason=suspended');
          return;
        }
        if (response.status === 403 && result.code === 'NO_ACTIVE_ORGANIZATION') {
          router.push('/supporter/no-organization');
          return;
        }
        throw new Error(result.error || 'メンバー追加に失敗しました');
      }

      const result = await response.json() as MemberCreateResponse;
      setSuccess(result.reused_existing_user
        ? '既存アカウントをメンバーに追加しました。パスワードは変更されません。'
        : 'メンバーを追加しました');
      setEmail('');
      setRealName('');
      setDisplayName('');
      setExternalPhone('');
      setDepartment('');
      setPhoneExtension('');
      setAdminNote('');
      setPassword('');
      setMemberRole('MEMBER');
      await loadMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'メンバー追加に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateMember = async (membershipId: string, payload: { role?: OrganizationRole; status?: MembershipStatus; department?: string; external_phone?: string; phone_extension?: string; admin_note?: string }) => {
    setError(null);
    setSuccess(null);
    setActionMemberId(membershipId);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('ログインが必要です');

      const response = await fetch(`/api/supporter/members/${membershipId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({})) as ApiErrorResponse;
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        if (response.status === 403 && result.code === 'ACCOUNT_SUSPENDED') {
          await supabase.auth.signOut();
          router.push('/login?reason=suspended');
          return;
        }
        if (response.status === 403 && result.code === 'NO_ACTIVE_ORGANIZATION') {
          router.push('/supporter/no-organization');
          return;
        }
        throw new Error(result.error || 'メンバー更新に失敗しました');
      }

      setSuccess('メンバー情報を更新しました');
      await loadMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'メンバー更新に失敗しました');
    } finally {
      setActionMemberId(null);
    }
  };

  const saveMemberDetails = async () => {
    if (!selectedMember) return;
    await updateMember(selectedMember.id, {
      department: detailDepartment,
      external_phone: detailExternalPhone,
      phone_extension: detailPhoneExtension,
      admin_note: detailAdminNote,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="max-w-5xl mx-auto px-6 py-12">
          <div className="flex items-center justify-center text-gray-500">
            <Loader2 className="animate-spin" />
            <span className="ml-2">読み込み中...</span>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-5xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
        <Link href="/supporter/dashboard" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-teal-600 mb-4">
          <ArrowLeft className="size-3" />
          ダッシュボードへ戻る
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">メンバー管理</h1>
            <p className="text-gray-500 mt-1">{data?.organization.name ?? '団体'} の担当者を管理します</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center sm:min-w-[240px]">
            <div className="bg-white border border-gray-100 rounded-xl px-4 py-3">
              <div className="text-xs text-gray-400">有効メンバー</div>
              <div className="text-xl font-black text-teal-600">{activeMembers}</div>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl px-4 py-3">
              <div className="text-xs text-gray-400">あなたの権限</div>
              <div className="text-xl font-black text-blue-600">{ROLE_LABEL[myRole]}</div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-700">
            {success}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="space-y-5">
          {selectedMember ? (
            <Card>
              <CardHeader className="border-b pb-4">
                <button type="button" onClick={() => setSelectedMemberId(null)} className="mb-2 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-teal-600">
                  <ArrowLeft className="size-3" />
                  担当者一覧へ戻る
                </button>
                <CardTitle className="text-base">{selectedMember.user?.display_name || selectedMember.user?.real_name || '担当者詳細'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><div className="text-xs text-gray-400">メールアドレス</div><div className="mt-1 break-all text-sm text-gray-700">{selectedMember.user?.email || '-'}</div></div>
                  <div>
                    <div className="text-xs text-gray-400">権限</div>
                    {canManage && selectedMember.status === 'ACTIVE' && selectedMember.id !== data?.my_membership.id ? (
                      <select value={selectedMember.role} onChange={(event) => updateMember(selectedMember.id, { role: event.target.value as OrganizationRole })} className="mt-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-sm font-semibold text-gray-700">
                        <option value="OWNER">OWNER</option>
                        <option value="ADMIN">ADMIN</option>
                        <option value="MEMBER">MEMBER</option>
                      </select>
                    ) : (
                      <div className="mt-1 text-sm text-gray-700">{ROLE_LABEL[selectedMember.role]}</div>
                    )}
                  </div>
                </div>
                {[{ label: '部署・所属', value: detailDepartment, setter: setDetailDepartment }, { label: '外線番号', value: detailExternalPhone, setter: setDetailExternalPhone }, { label: '内線番号', value: detailPhoneExtension, setter: setDetailPhoneExtension }].map(({ label, value, setter }) => (
                  <div className="space-y-2" key={label}>
                    <Label>{label}</Label>
                    <Input value={value} onChange={(event) => setter(event.target.value)} disabled={!canEditSelectedMember} />
                  </div>
                ))}
                <div className="space-y-2">
                  <Label htmlFor="detailAdminNote">管理メモ</Label>
                  <textarea id="detailAdminNote" rows={4} maxLength={1000} value={detailAdminNote} onChange={(event) => setDetailAdminNote(event.target.value)} disabled={!canEditSelectedMember} className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm disabled:bg-gray-50" />
                </div>
                {canEditSelectedMember && (
                  <Button onClick={saveMemberDetails} disabled={actionMemberId === selectedMember.id} className="bg-teal-600 hover:bg-teal-700">
                    {actionMemberId === selectedMember.id ? <Loader2 className="animate-spin" /> : <Save />}
                    保存する
                  </Button>
                )}
                {canManage && selectedMember.id !== data?.my_membership.id && (
                  <div className="flex flex-wrap gap-2 border-t pt-4">
                    {selectedMember.status === 'ACTIVE' && <Button size="sm" variant="outline" onClick={() => updateMember(selectedMember.id, { status: 'SUSPENDED' })}><UserMinus />停止</Button>}
                    {selectedMember.status === 'SUSPENDED' && <Button size="sm" variant="outline" onClick={() => updateMember(selectedMember.id, { status: 'ACTIVE' })}><RotateCcw />復帰</Button>}
                    {selectedMember.status !== 'LEFT' && <Button size="sm" variant="outline" onClick={() => updateMember(selectedMember.id, { status: 'LEFT' })}>所属解除</Button>}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
          <>
          <Card>
            <CardHeader className="border-b pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-4 text-teal-600" />
                所属メンバー
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500">
                    <tr>
                      <th className="px-5 py-3 text-left font-medium">担当者</th>
                      <th className="px-5 py-3 text-left font-medium">権限</th>
                      <th className="px-5 py-3 text-left font-medium">状態</th>
                      <th className="px-5 py-3 text-left font-medium">参加日</th>
                      <th className="px-5 py-3 text-right font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {currentMembers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-5 py-8 text-center text-sm text-gray-400">
                          有効な所属メンバーはいません。
                        </td>
                      </tr>
                    )}
                    {currentMembers.map((member) => {
                      const isSelf = member.id === data?.my_membership.id;
                      const isBusy = actionMemberId === member.id;
                      const user = member.user;
                      const canOperate = canManage && !isSelf;

                      return (
                        <tr key={member.id} className={member.status === 'LEFT' ? 'bg-gray-50 text-gray-400' : 'bg-white'}>
                          <td className="px-5 py-4">
                            <button type="button" onClick={() => openMemberDetails(member)} className="text-left font-semibold text-gray-800 hover:text-teal-600">
                              {user?.display_name || user?.real_name || '不明'}
                              {isSelf && <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-600">あなた</span>}
                            </button>
                            <div className="mt-1 text-xs text-gray-500">{user?.email || '-'}</div>
                          </td>
                          <td className="px-5 py-4">
                            {canOperate && member.status === 'ACTIVE' ? (
                              <select
                                value={member.role}
                                onChange={(event) => updateMember(member.id, { role: event.target.value as OrganizationRole })}
                                disabled={isBusy}
                                className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-700"
                              >
                                <option value="OWNER">OWNER</option>
                                <option value="ADMIN">ADMIN</option>
                                <option value="MEMBER">MEMBER</option>
                              </select>
                            ) : (
                              <div>
                                <div className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700">
                                  <Shield className="size-3" />
                                  {ROLE_LABEL[member.role]}
                                </div>
                                <div className="mt-1 text-[11px] text-gray-400">{ROLE_HELP[member.role]}</div>
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_CLASS[member.status]}`}>
                              {STATUS_LABEL[member.status]}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-xs text-gray-500">
                            {formatDate(member.joined_at || member.created_at)}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-2">
                              {isBusy ? (
                                <Button size="sm" variant="outline" disabled>
                                  <Loader2 className="animate-spin" />
                                  更新中
                                </Button>
                              ) : canOperate && member.status === 'ACTIVE' ? (
                                <>
                                  <Button size="sm" variant="outline" onClick={() => updateMember(member.id, { status: 'SUSPENDED' })}>
                                    <UserMinus />
                                    停止
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => updateMember(member.id, { status: 'LEFT' })}>
                                    所属解除
                                  </Button>
                                </>
                              ) : canOperate && member.status === 'SUSPENDED' ? (
                                <>
                                  <Button size="sm" variant="outline" onClick={() => updateMember(member.id, { status: 'ACTIVE' })}>
                                    <RotateCcw />
                                    復帰
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => updateMember(member.id, { status: 'LEFT' })}>
                                    所属解除
                                  </Button>
                                </>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="divide-y divide-gray-100 md:hidden">
                {currentMembers.map((member) => (
                  <button key={member.id} type="button" onClick={() => openMemberDetails(member)} className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-gray-800">{member.user?.display_name || member.user?.real_name || '不明'}</div>
                      <div className="mt-1 truncate text-xs text-gray-500">{member.user?.email || '-'}</div>
                      <div className="mt-2 flex flex-wrap gap-2"><span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLASS[member.status]}`}>{STATUS_LABEL[member.status]}</span><span className="text-[11px] text-gray-500">{ROLE_LABEL[member.role]}</span></div>
                    </div>
                    <ChevronRight className="size-4 flex-none text-gray-400" />
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {leftMembers.length > 0 && (
            <Card className="lg:col-span-1">
              <CardHeader className="border-b pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <RotateCcw className="size-4 text-amber-600" />
                  所属解除中
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                {leftMembers.map((member) => {
                  const user = member.user;
                  const isBusy = actionMemberId === member.id;

                  return (
                    <div key={member.id} className="flex items-center justify-between gap-3 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-gray-800">
                          {user?.display_name || user?.real_name || '不明'}
                        </div>
                        <div className="truncate text-xs text-gray-500">{user?.email || '-'}</div>
                      </div>
                      {canManage ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isBusy}
                          onClick={() => updateMember(member.id, { status: 'ACTIVE' })}
                        >
                          {isBusy ? <Loader2 className="animate-spin" /> : <RotateCcw />}
                          所属復活
                        </Button>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
          </>
          )}
          </div>

          <Card>
            <CardHeader className="border-b pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <UserPlus className="size-4 text-teal-600" />
                メンバー追加
              </CardTitle>
            </CardHeader>
            <CardContent>
              {canAdd ? (
                <form onSubmit={handleAddMember} className="space-y-4">
                  <div className="grid grid-cols-2 gap-1 rounded-md bg-gray-100 p-1 text-xs">
                    <button type="button" onClick={() => setRegistrationType('new')} className={`rounded px-2 py-2 ${registrationType === 'new' ? 'bg-white font-semibold text-gray-800 shadow-sm' : 'text-gray-500'}`}>新しいアカウントを作成</button>
                    <button type="button" onClick={() => setRegistrationType('existing')} className={`rounded px-2 py-2 ${registrationType === 'existing' ? 'bg-white font-semibold text-gray-800 shadow-sm' : 'text-gray-500'}`}>登録済みアカウントを所属に追加</button>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="memberEmail">メールアドレス <span className="text-red-500">*</span></Label>
                    <Input id="memberEmail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
                  </div>
                  {registrationType === 'new' && <>
                    <div className="space-y-2"><Label htmlFor="memberRealName">担当者名</Label><Input id="memberRealName" value={realName} onChange={(event) => setRealName(event.target.value)} maxLength={64} /></div>
                    <div className="space-y-2"><Label htmlFor="memberDisplayName">表示名</Label><Input id="memberDisplayName" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={64} /></div>
                    <div className="space-y-2"><Label htmlFor="memberDepartment">部署・所属</Label><Input id="memberDepartment" value={department} onChange={(event) => setDepartment(event.target.value)} maxLength={100} /></div>
                    <div className="space-y-2"><Label htmlFor="memberExternalPhone">外線番号</Label><Input id="memberExternalPhone" type="tel" value={externalPhone} onChange={(event) => setExternalPhone(event.target.value)} maxLength={30} /></div>
                    <div className="space-y-2"><Label htmlFor="memberPhoneExtension">内線番号</Label><Input id="memberPhoneExtension" value={phoneExtension} onChange={(event) => setPhoneExtension(event.target.value)} maxLength={30} /></div>
                    <div className="space-y-2"><Label htmlFor="memberAdminNote">管理メモ</Label><textarea id="memberAdminNote" rows={3} maxLength={1000} value={adminNote} onChange={(event) => setAdminNote(event.target.value)} className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm" /></div>
                  </>}
                  {registrationType === 'new' && <div className="space-y-2">
                    <Label htmlFor="memberRole">権限</Label>
                    <select
                      id="memberRole"
                      value={memberRole}
                      onChange={(event) => setMemberRole(event.target.value as OrganizationRole)}
                      className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm"
                    >
                      {myRole === 'OWNER' && (
                        <>
                          <option value="OWNER">OWNER</option>
                          <option value="ADMIN">ADMIN</option>
                        </>
                      )}
                      <option value="MEMBER">MEMBER</option>
                    </select>
                  </div>}
                  {registrationType === 'new' && <div className="space-y-2">
                    <Label htmlFor="memberPassword">初期パスワード <span className="text-xs font-normal text-gray-400">（新規メンバーのみ）</span></Label>
                    <div className="flex gap-2">
                      <Input id="memberPassword" type="text" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={64} />
                      <Button type="button" variant="outline" size="icon" onClick={() => setPassword(generatePassword())} title="生成">
                        <KeyRound />
                      </Button>
                    </div>
                    <p className="text-xs text-gray-400">
                      既存アカウントの再追加・移籍では、現在のパスワードをそのまま使います。
                    </p>
                  </div>}
                  <Button type="submit" disabled={isSubmitting} className="w-full bg-teal-600 hover:bg-teal-700">
                    {isSubmitting ? <Loader2 className="animate-spin" /> : <UserPlus />}
                    追加する
                  </Button>
                </form>
              ) : (
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 text-sm text-gray-500">
                  メンバー追加は OWNER または ADMIN が利用できます。
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Building2, Loader2, Pencil, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';

// 1案件1団体制のため、メモは自団体内の引き継ぎ用(ORGANIZATION_ONLY)のみ。
// 他団体との共有メモ(APPROVED_SUPPORTERS)は廃止。過去データはDBに残るが表示しない。
type InternalNote = {
  id: string;
  body: string;
  author_display_name: string;
  organization_name: string;
  created_at: string;
  updated_at: string;
  can_edit: boolean;
};

type InternalNotesPanelProps = {
  caseId: string;
  accessToken: string;
};

type SortOrder = 'newest' | 'oldest';

export function InternalNotesPanel({ caseId, accessToken }: InternalNotesPanelProps) {
  const toast = useToast();
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');

  const loadNotes = useCallback(async () => {
    setIsLoading(true);
    setLoadError(false);
    try {
      const res = await fetch(`/api/supporter/cases/${caseId}/internal-notes`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('メモを取得できませんでした');
      const data = await res.json();
      setNotes(data.notes || []);
    } catch (error) {
      console.error('[InternalNotesPanel] load error:', error);
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, caseId]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const submitNote = async () => {
    if (!draft.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/supporter/cases/${caseId}/internal-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ visibility: 'ORGANIZATION_ONLY', body: draft }),
      });
      if (!res.ok) throw new Error('メモを登録できませんでした');
      setDraft('');
      await loadNotes();
      toast.success('内部メモを追加しました');
    } catch (error) {
      console.error('[InternalNotesPanel] submit error:', error);
      toast.error('内部メモの登録に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveNote = async () => {
    if (!editingId || !editingBody.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/supporter/cases/${caseId}/internal-notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ note_id: editingId, body: editingBody }),
      });
      if (!res.ok) throw new Error('メモを更新できませんでした');
      setEditingId(null);
      setEditingBody('');
      await loadNotes();
      toast.success('内部メモを更新しました');
    } catch (error) {
      console.error('[InternalNotesPanel] update error:', error);
      toast.error('内部メモの更新に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteNote = async (noteId: string) => {
    if (!window.confirm('この内部メモを削除しますか？') || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/supporter/cases/${caseId}/internal-notes`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ note_id: noteId }),
      });
      if (!res.ok) throw new Error('メモを削除できませんでした');
      await loadNotes();
      toast.success('内部メモを削除しました');
    } catch (error) {
      console.error('[InternalNotesPanel] delete error:', error);
      toast.error('内部メモの削除に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const visibleNotes = [...notes].sort((a, b) => {
    const difference = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    return sortOrder === 'newest' ? difference : -difference;
  });
  const formatDateTime = (date: string) =>
    new Date(date).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <Card className="mb-6 border-amber-200 bg-amber-50/30 transition-colors">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base text-gray-800">内部メモ（自団体のみ）</CardTitle>
            <p className="mt-1 text-xs text-gray-500">SOSユーザーには表示されません</p>
          </div>
          <Button size="sm" variant="outline" onClick={loadNotes} disabled={isLoading} title="内部メモを更新">
            <RefreshCw className={isLoading ? 'animate-spin' : ''} />
            更新
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
          <Building2 className="mt-0.5 size-4 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold">自団体のみ</p>
            <p className="text-xs">この団体に所属するメンバーだけに表示されます。担当引き継ぎの記録にご利用ください</p>
          </div>
        </div>
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            maxLength={3000}
            placeholder="自団体の担当者向けに記録する"
            className="w-full resize-none rounded-md border border-amber-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-gray-400">{draft.length} / 3000</span>
            <Button size="sm" onClick={submitNote} disabled={!draft.trim() || isSubmitting} className="bg-amber-600 text-white hover:bg-amber-700">
              {isSubmitting ? <Loader2 className="animate-spin" /> : <Plus />}
              自団体メモを追加
            </Button>
          </div>
        </div>

        <div className="space-y-2 border-t border-gray-200 pt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">{visibleNotes.length}件</p>
            <div className="flex rounded-md border border-gray-200 bg-white p-0.5">
              <button
                type="button"
                onClick={() => setSortOrder('newest')}
                className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${sortOrder === 'newest' ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <ArrowDown className="size-3" />
                新しい順
              </button>
              <button
                type="button"
                onClick={() => setSortOrder('oldest')}
                className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${sortOrder === 'oldest' ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <ArrowUp className="size-3" />
                古い順
              </button>
            </div>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-5 text-gray-400">
              <Loader2 className="mr-2 size-4 animate-spin" />
              <span className="text-sm">読み込み中...</span>
            </div>
          ) : loadError ? (
            <p className="py-4 text-center text-sm text-red-500">内部メモの読み込みに失敗しました</p>
          ) : visibleNotes.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">メモはまだありません</p>
          ) : (
            visibleNotes.map((note) => (
              <div key={note.id} className="rounded-md border border-amber-100 bg-white p-3">
                {editingId === note.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editingBody}
                      onChange={(event) => setEditingBody(event.target.value)}
                      rows={3}
                      maxLength={3000}
                      className="w-full resize-none rounded-md border border-amber-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                    />
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setEditingId(null); setEditingBody(''); }}>
                        <X />
                        戻る
                      </Button>
                      <Button size="sm" onClick={saveNote} disabled={!editingBody.trim() || isSubmitting} className="bg-amber-600 text-white hover:bg-amber-700">
                        <Save />
                        保存
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-700">{note.body}</p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-2">
                      <p className="text-xs text-gray-400">
                        {note.organization_name} / {note.author_display_name} / {formatDateTime(note.created_at)}
                        {note.updated_at !== note.created_at ? ' 更新済み' : ''}
                      </p>
                      {note.can_edit && (
                        <div className="flex gap-1">
                          <Button size="icon-xs" variant="ghost" title="編集" onClick={() => { setEditingId(note.id); setEditingBody(note.body); }}>
                            <Pencil />
                          </Button>
                          <Button size="icon-xs" variant="ghost" title="削除" onClick={() => deleteNote(note.id)} className="text-red-500 hover:text-red-600">
                            <Trash2 />
                          </Button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
      <toast.ToastContainer />
    </Card>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowDown, ArrowUp, Building2, Loader2, Pencil, Plus, RefreshCw, Save, Trash2, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';

type NoteVisibility = 'ORGANIZATION_ONLY' | 'APPROVED_SUPPORTERS';

type InternalNote = {
  id: string;
  body: string;
  visibility: NoteVisibility;
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

const TAB_CONFIG = {
  ORGANIZATION_ONLY: {
    labelKey: 'orgLabel',
    descriptionKey: 'orgDesc',
    placeholderKey: 'orgPlaceholder',
    submitKey: 'orgSubmit',
    icon: Building2,
    card: 'border-amber-200 bg-amber-50/30',
    tab: 'bg-amber-100 text-amber-900',
    notice: 'border-amber-200 bg-amber-50 text-amber-800',
    input: 'border-amber-200 focus:ring-amber-300',
    button: 'bg-amber-600 text-white hover:bg-amber-700',
    note: 'border-amber-100',
  },
  APPROVED_SUPPORTERS: {
    labelKey: 'sharedLabel',
    descriptionKey: 'sharedDesc',
    placeholderKey: 'sharedPlaceholder',
    submitKey: 'sharedSubmit',
    icon: Users,
    card: 'border-blue-200 bg-blue-50/30',
    tab: 'bg-blue-100 text-blue-900',
    notice: 'border-blue-200 bg-blue-50 text-blue-800',
    input: 'border-blue-200 focus:ring-blue-300',
    button: 'bg-blue-600 text-white hover:bg-blue-700',
    note: 'border-blue-100',
  },
} as const;

export function InternalNotesPanel({ caseId, accessToken }: InternalNotesPanelProps) {
  const t = useTranslations('supporter.notes');
  const tSupporter = useTranslations('supporter');
  const tActions = useTranslations('common.actions');
  const locale = useLocale();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<NoteVisibility>('ORGANIZATION_ONLY');
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [drafts, setDrafts] = useState<Record<NoteVisibility, string>>({
    ORGANIZATION_ONLY: '',
    APPROVED_SUPPORTERS: '',
  });
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
      if (!res.ok) throw new Error('load failed');
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
    const draft = drafts[activeTab];
    if (!draft.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/supporter/cases/${caseId}/internal-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ visibility: activeTab, body: draft }),
      });
      if (!res.ok) throw new Error('create failed');
      setDrafts((current) => ({ ...current, [activeTab]: '' }));
      await loadNotes();
      toast.success(t('added'));
    } catch (error) {
      console.error('[InternalNotesPanel] submit error:', error);
      toast.error(t('addFailed'));
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
      if (!res.ok) throw new Error('update failed');
      setEditingId(null);
      setEditingBody('');
      await loadNotes();
      toast.success(t('updated'));
    } catch (error) {
      console.error('[InternalNotesPanel] update error:', error);
      toast.error(t('updateFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteNote = async (noteId: string) => {
    if (!window.confirm(t('deleteConfirm')) || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/supporter/cases/${caseId}/internal-notes`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ note_id: noteId }),
      });
      if (!res.ok) throw new Error('delete failed');
      await loadNotes();
      toast.success(t('deleted'));
    } catch (error) {
      console.error('[InternalNotesPanel] delete error:', error);
      toast.error(t('deleteFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const config = TAB_CONFIG[activeTab];
  const ActiveTabIcon = config.icon;
  const visibleNotes = notes
    .filter((note) => note.visibility === activeTab)
    .sort((a, b) => {
      const difference = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return sortOrder === 'newest' ? difference : -difference;
    });
  const formatDateTime = (date: string) =>
    new Date(date).toLocaleString(locale, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <Card className={`mb-6 transition-colors ${config.card}`}>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base text-gray-800">{t('title')}</CardTitle>
            <p className="mt-1 text-xs text-gray-500">{t('subtitle')}</p>
          </div>
          <Button size="sm" variant="outline" onClick={loadNotes} disabled={isLoading} title={t('refreshTitle')}>
            <RefreshCw className={isLoading ? 'animate-spin' : ''} />
            {t('refresh')}
          </Button>
        </div>
        <div className="flex w-full rounded-md border border-gray-200 bg-white p-1 sm:w-fit">
          {(Object.keys(TAB_CONFIG) as NoteVisibility[]).map((tabId) => {
            const tab = TAB_CONFIG[tabId];
            const TabIcon = tab.icon;
            return (
            <button
              key={tabId}
              type="button"
              onClick={() => {
                setActiveTab(tabId);
                setEditingId(null);
                setEditingBody('');
              }}
              className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors sm:flex-none ${
                activeTab === tabId ? tab.tab : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                <TabIcon className="size-3.5" />
                {t(tab.labelKey)}
              </span>
            </button>
            );
          })}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`flex items-start gap-2 rounded-md border px-3 py-2 ${config.notice}`}>
          <ActiveTabIcon className="mt-0.5 size-4 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold">{t(config.labelKey)}</p>
            <p className="text-xs">{t(config.descriptionKey)}</p>
          </div>
        </div>
        <div className="space-y-2">
          <textarea
            value={drafts[activeTab]}
            onChange={(event) => setDrafts((current) => ({ ...current, [activeTab]: event.target.value }))}
            rows={3}
            maxLength={3000}
            placeholder={t(config.placeholderKey)}
            className={`w-full resize-none rounded-md border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 ${config.input}`}
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-gray-400">{drafts[activeTab].length} / 3000</span>
            <Button size="sm" onClick={submitNote} disabled={!drafts[activeTab].trim() || isSubmitting} className={config.button}>
              {isSubmitting ? <Loader2 className="animate-spin" /> : <Plus />}
              {t(config.submitKey)}
            </Button>
          </div>
        </div>

        <div className="space-y-2 border-t border-gray-200 pt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">{t('count', { count: visibleNotes.length })}</p>
            <div className="flex rounded-md border border-gray-200 bg-white p-0.5">
              <button
                type="button"
                onClick={() => setSortOrder('newest')}
                className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${sortOrder === 'newest' ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <ArrowDown className="size-3" />
                {t('newest')}
              </button>
              <button
                type="button"
                onClick={() => setSortOrder('oldest')}
                className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${sortOrder === 'oldest' ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <ArrowUp className="size-3" />
                {t('oldest')}
              </button>
            </div>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-5 text-gray-400">
              <Loader2 className="mr-2 size-4 animate-spin" />
              <span className="text-sm">{tSupporter('loading')}</span>
            </div>
          ) : loadError ? (
            <p className="py-4 text-center text-sm text-red-500">{t('loadFailed')}</p>
          ) : visibleNotes.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">{t('empty')}</p>
          ) : (
            visibleNotes.map((note) => (
              <div key={note.id} className={`rounded-md border bg-white p-3 ${config.note}`}>
                {editingId === note.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editingBody}
                      onChange={(event) => setEditingBody(event.target.value)}
                      rows={3}
                      maxLength={3000}
                      className={`w-full resize-none rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${config.input}`}
                    />
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setEditingId(null); setEditingBody(''); }}>
                        <X />
                        {tActions('back')}
                      </Button>
                      <Button size="sm" onClick={saveNote} disabled={!editingBody.trim() || isSubmitting} className={config.button}>
                        <Save />
                        {t('save')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-700">{note.body}</p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-2">
                      <p className="text-xs text-gray-400">
                        {note.organization_name} / {note.author_display_name} / {formatDateTime(note.created_at)}
                        {note.updated_at !== note.created_at ? t('edited') : ''}
                      </p>
                      {note.can_edit && (
                        <div className="flex gap-1">
                          <Button size="icon-xs" variant="ghost" title={t('edit')} onClick={() => { setEditingId(note.id); setEditingBody(note.body); }}>
                            <Pencil />
                          </Button>
                          <Button size="icon-xs" variant="ghost" title={t('delete')} onClick={() => deleteNote(note.id)} className="text-red-500 hover:text-red-600">
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

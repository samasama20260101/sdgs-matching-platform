// ─────────────────────────────────────────────────────────────
// 📂 src/components/chat/MessageThread.tsx
// 案件内メッセージスレッド（SOS・サポーター共通）
// RLS対策：全DB操作を /api/messages 経由に変更済み
// ─────────────────────────────────────────────────────────────
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';

type Message = {
    id: string;
    content: string;
    created_at: string;
    sender_user_id: string;
    // システムメッセージのID＋パラメータ（設計§5.5。NULL=通常 or 旧形式）
    system_key?: string | null;
    system_params?: Record<string, string> | null;
    // 送信時翻訳（設計§5.8）
    source_locale?: string | null;
    translated_content?: string | null;
    translation_status?: 'NONE' | 'DONE' | 'PENDING' | 'FAILED' | null;
    sender?: {
        display_name: string;
        role: string;
        organization_name?: string | null;
    };
};

type Props = {
    caseId: string;
    currentUserId: string; // public.users.id
    accessToken: string;   // Supabase JWT（APIルートの認証に使用）
    readOnly?: boolean;    // RESOLVED時に入力を無効化
};

const MESSAGE_POLL_INTERVAL_MS = 60_000;

export default function MessageThread({ caseId, currentUserId, accessToken, readOnly = false }: Props) {
    const t = useTranslations('common.chat');
    const tSystem = useTranslations('system');
    const locale = useLocale();
    const [messages, setMessages] = useState<Message[]>([]);
    const [showOriginalIds, setShowOriginalIds] = useState<Set<string>>(new Set());
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const didInitialScrollRef = useRef(false);
    const shouldScrollToBottomRef = useRef(false);

    const isNearBottom = useCallback(() => {
        const container = messagesContainerRef.current;
        if (!container) return true;
        return container.scrollHeight - container.scrollTop - container.clientHeight < 80;
    }, []);

    // メッセージ読み込み（API経由でRLSバイパス）
    const loadMessages = useCallback(async (options: { forceScroll?: boolean } = {}) => {
        try {
            const res = await fetch(`/api/messages?case_id=${caseId}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` },
            });
            if (!res.ok) {
                setError(t('errorLoad'));
                setIsLoading(false);
                return;
            }
            const { messages: data } = await res.json();
            shouldScrollToBottomRef.current = options.forceScroll || !didInitialScrollRef.current || isNearBottom();
            setMessages(data || []);
            setError(null);
        } catch (err) {
            console.error('Load messages error:', err);
            setError(t('errorLoad'));
        } finally {
            setIsLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [caseId, accessToken, isNearBottom]);

    useEffect(() => { loadMessages(); }, [loadMessages]);

    // 表示中のタブだけ定期更新する。DBのRealtime payloadをクライアントへ直接出さない。
    useEffect(() => {
        const refreshIfVisible = () => {
            if (document.visibilityState !== 'visible') return;
            void loadMessages();
        };
        const intervalId = window.setInterval(refreshIfVisible, MESSAGE_POLL_INTERVAL_MS);
        document.addEventListener('visibilitychange', refreshIfVisible);

        return () => {
            window.clearInterval(intervalId);
            document.removeEventListener('visibilitychange', refreshIfVisible);
        };
    }, [loadMessages]);

    // チャット枠内だけをスクロールする。ページ全体を動かす scrollIntoView は使わない。
    useEffect(() => {
        if (!shouldScrollToBottomRef.current) return;
        const container = messagesContainerRef.current;
        if (!container) return;
        container.scrollTop = container.scrollHeight;
        didInitialScrollRef.current = true;
        shouldScrollToBottomRef.current = false;
    }, [messages]);

    // メッセージ送信（API経由）
    const handleSend = async () => {
        const content = newMessage.trim();
        if (!content || isSending) return;

        setIsSending(true);
        setError(null);
        try {
            const res = await fetch('/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
                body: JSON.stringify({ case_id: caseId, content }),
            });
            if (!res.ok) {
                setError(t('errorSend'));
                return;
            }
            setNewMessage('');
            if (textareaRef.current) textareaRef.current.style.height = 'auto';
            await loadMessages({ forceScroll: true });
        } catch (err) {
            console.error('Send error:', err);
            setError(t('errorGeneric'));
        } finally {
            setIsSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setNewMessage(e.target.value);
        const textarea = e.target;
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    };

    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
        const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
        if (diffDays === 0) return time;
        if (diffDays === 1) return `${t('yesterday')} ${time}`;
        if (diffDays < 7) return `${t('daysAgo', { days: diffDays })} ${time}`;
        return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' }) + ` ${time}`;
    };

    const getSenderLabel = (msg: Message) => {
        if (!msg.sender) return t('unknown');
        if (msg.sender.role === 'SUPPORTER' && msg.sender.organization_name) {
            return t('staffLabel', { org: msg.sender.organization_name, name: msg.sender.display_name });
        }
        return msg.sender.display_name;
    };

    const getSenderRoleBadge = (msg: Message) => {
        if (!msg.sender) return null;
        if (msg.sender.role === 'SOS') {
            return <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 font-medium">{t('roleSos')}</span>;
        }
        return <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-600 font-medium">{t('roleSupporter')}</span>;
    };

    if (isLoading) {
        return (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <div className="animate-pulse flex flex-col items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-200" />
                    <div className="h-3 w-24 bg-gray-200 rounded" />
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* ヘッダー */}
            <div className="px-5 py-3 bg-gradient-to-r from-blue-50 to-teal-50 border-b border-gray-100">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-base">💬</span>
                        <h3 className="text-sm font-bold text-gray-800">{t('title')}</h3>
                        {messages.length > 0 && <span className="text-[11px] text-gray-400">{t('count', { count: messages.length })}</span>}
                    </div>
                    <button onClick={() => { void loadMessages(); }} className="text-xs text-gray-400 hover:text-blue-500 transition-colors">
                        {t('refresh')}
                    </button>
                </div>
            </div>

            {/* メッセージ一覧 */}
            <div ref={messagesContainerRef} className="h-[360px] overflow-y-auto px-4 py-3 space-y-3 bg-gray-50/50">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <div className="text-3xl mb-2 opacity-50">💬</div>
                        <p className="text-sm text-gray-400">{t('empty')}</p>
                        <p className="text-xs text-gray-300 mt-1">{t('emptyHint')}</p>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isMe = msg.sender_user_id === currentUserId;
                        const isSystem = !!msg.system_key || msg.content.startsWith('__SYSTEM__');

                        if (isSystem) {
                            // system_key があれば閲覧者の言語でレンダリング。
                            // なければ旧形式（日本語文の焼き込み）にフォールバック。
                            let systemText = msg.content.replace('__SYSTEM__', '');
                            if (msg.system_key) {
                                try {
                                    systemText = tSystem(msg.system_key, msg.system_params ?? {});
                                } catch {
                                    // 未知のキー（新旧クライアント差など）は content にフォールバック
                                }
                            }
                            return (
                                <div key={msg.id} className="flex justify-center my-2">
                                    <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-2.5 max-w-[85%] text-center">
                                        <p className="text-sm text-orange-700 font-medium">⚠️ {systemText}</p>
                                        <p className="text-[10px] text-orange-400 mt-1">{formatTime(msg.created_at)}</p>
                                    </div>
                                </div>
                            );
                        }

                        // 閲覧者の言語に合わせて原文/訳文を選ぶ（設計§5.8）
                        const sourceLocale = msg.source_locale || 'ja';
                        const isForeignToViewer = sourceLocale !== locale;
                        const showTranslated = isForeignToViewer && !!msg.translated_content;
                        const displayContent = showTranslated ? msg.translated_content! : msg.content;
                        const showOriginal = showOriginalIds.has(msg.id);
                        const translationNote = isForeignToViewer && !msg.translated_content
                            ? (msg.translation_status === 'PENDING' ? t('translationPending')
                                : msg.translation_status === 'FAILED' ? t('translationFailed')
                                    : null)
                            : null;

                        return (
                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[75%] ${isMe
                                    ? 'bg-blue-600 text-white rounded-2xl rounded-br-md'
                                    : 'bg-white text-gray-800 rounded-2xl rounded-bl-md border border-gray-200'
                                    } px-4 py-2.5 shadow-sm`}>
                                    <div className="flex items-center gap-1.5 mb-1">
                                            <span className={`text-xs font-semibold ${isMe ? 'text-blue-100' : 'text-gray-700'}`}>{getSenderLabel(msg)}</span>
                                            {getSenderRoleBadge(msg)}
                                    </div>
                                    <p className={`text-sm whitespace-pre-wrap leading-relaxed ${isMe ? 'text-white' : 'text-gray-700'}`}>
                                        {displayContent}
                                    </p>
                                    {showTranslated && (
                                        <div className={`mt-1.5 flex items-center gap-2 text-[10px] ${isMe ? 'text-blue-200' : 'text-gray-400'}`}>
                                            <span className={`px-1.5 py-0.5 rounded ${isMe ? 'bg-blue-500/40' : 'bg-gray-100'}`}>🌐 {t('translatedLabel')}</span>
                                            <button
                                                type="button"
                                                onClick={() => setShowOriginalIds(prev => {
                                                    const next = new Set(prev);
                                                    if (next.has(msg.id)) next.delete(msg.id); else next.add(msg.id);
                                                    return next;
                                                })}
                                                className="underline underline-offset-2 hover:opacity-80"
                                            >
                                                {showOriginal ? t('hideOriginal') : t('showOriginal')}
                                            </button>
                                        </div>
                                    )}
                                    {showTranslated && showOriginal && (
                                        <p className={`mt-1.5 text-xs whitespace-pre-wrap leading-relaxed border-l-2 pl-2 ${isMe ? 'text-blue-100 border-blue-300/60' : 'text-gray-500 border-gray-200'}`}>
                                            {msg.content}
                                        </p>
                                    )}
                                    {translationNote && (
                                        <p className={`mt-1 text-[10px] ${isMe ? 'text-blue-200' : 'text-gray-400'}`}>{translationNote}</p>
                                    )}
                                    <div className={`text-[10px] mt-1 ${isMe ? 'text-blue-200 text-right' : 'text-gray-400'}`}>
                                        {formatTime(msg.created_at)}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* エラー表示 */}
            {error && (
                <div className="px-4 py-2 bg-red-50 border-t border-red-100">
                    <p className="text-xs text-red-600">{error}</p>
                </div>
            )}

            {/* 入力エリア */}
            {readOnly ? (
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-center">
                    <p className="text-xs text-gray-400">{t('readOnlyNote')}</p>
                </div>
            ) : (
                <div className="px-4 py-3 bg-white border-t border-gray-100">
                    <div className="flex items-end gap-2">
                        <textarea
                            ref={textareaRef}
                            value={newMessage}
                            onChange={handleTextareaInput}
                            onKeyDown={handleKeyDown}
                            placeholder={t('inputPlaceholder')}
                            rows={1}
                            className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-2.5 text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300
                placeholder:text-gray-300 bg-gray-50/50 transition-all"
                            style={{ minHeight: '40px', maxHeight: '120px' }}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!newMessage.trim() || isSending}
                            className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-r from-blue-600 to-teal-600
                text-white flex items-center justify-center
                hover:from-blue-700 hover:to-teal-700
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-all active:scale-95"
                        >
                            {isSending ? (
                                <span className="animate-spin text-sm">⟳</span>
                            ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

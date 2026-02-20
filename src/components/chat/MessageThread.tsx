// ─────────────────────────────────────────────────────────────
// 📂 src/components/chat/MessageThread.tsx
// 案件内メッセージスレッド（SOS・サポーター共通）
// ─────────────────────────────────────────────────────────────
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';

type Message = {
    id: string;
    content: string;
    created_at: string;
    sender_user_id: string;
    sender?: {
        display_name: string;
        role: string;
        organization_name?: string | null;
    };
};

type Props = {
    caseId: string;
    currentUserId: string; // public.users.id
    readOnly?: boolean;    // RESOLVED時に入力を無効化
};

export default function MessageThread({ caseId, currentUserId, readOnly = false }: Props) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // メッセージ読み込み
    const loadMessages = useCallback(async () => {
        try {
            // まずメッセージを取得
            const { data: messagesData, error: msgError } = await supabase
                .from('messages')
                .select('*')
                .eq('case_id', caseId)
                .order('created_at', { ascending: true });

            if (msgError) {
                console.error('Messages fetch error:', msgError);
                setError('メッセージの取得に失敗しました');
                setIsLoading(false);
                return;
            }

            if (!messagesData || messagesData.length === 0) {
                setMessages([]);
                setIsLoading(false);
                return;
            }

            // 送信者情報を取得
            const senderIds = [...new Set(messagesData.map((m) => m.sender_user_id))];
            const { data: senders } = await supabase
                .from('users')
                .select('id, display_name, role, organization_name')
                .in('id', senderIds);

            const senderMap = new Map(
                (senders || []).map((s) => [s.id, s])
            );

            const enriched = messagesData.map((m) => ({
                ...m,
                sender: senderMap.get(m.sender_user_id) || {
                    display_name: '不明',
                    role: 'UNKNOWN',
                    organization_name: null,
                },
            }));

            setMessages(enriched);
            setError(null);
        } catch (err) {
            console.error('Load messages error:', err);
            setError('メッセージの取得に失敗しました');
        } finally {
            setIsLoading(false);
        }
    }, [caseId]);

    // 初回読み込み
    useEffect(() => {
        loadMessages();
    }, [loadMessages]);

    // リアルタイム購読
    useEffect(() => {
        const channel = supabase
            .channel(`messages:${caseId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `case_id=eq.${caseId}`,
                },
                () => {
                    // 新着メッセージを再読み込み
                    loadMessages();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [caseId, loadMessages]);

    // 自動スクロール
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // メッセージ送信
    const handleSend = async () => {
        const content = newMessage.trim();
        if (!content || isSending) return;

        setIsSending(true);
        setError(null);

        try {
            const { error: insertError } = await supabase.from('messages').insert([
                {
                    case_id: caseId,
                    sender_user_id: currentUserId,
                    content,
                },
            ]);

            if (insertError) {
                console.error('Send message error:', insertError);
                setError('メッセージの送信に失敗しました');
                return;
            }

            setNewMessage('');
            // テキストエリアの高さをリセット
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
            await loadMessages();
        } catch (err) {
            console.error('Send error:', err);
            setError('エラーが発生しました');
        } finally {
            setIsSending(false);
        }
    };

    // Enter で送信 (Shift+Enter は改行)
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // テキストエリア自動リサイズ
    const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setNewMessage(e.target.value);
        const textarea = e.target;
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    };

    // 日時フォーマット
    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

        const time = d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

        if (diffDays === 0) return time;
        if (diffDays === 1) return `昨日 ${time}`;
        if (diffDays < 7) return `${diffDays}日前 ${time}`;
        return d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }) + ` ${time}`;
    };

    // 送信者ラベル
    const getSenderLabel = (msg: Message) => {
        if (!msg.sender) return '不明';
        if (msg.sender.role === 'SUPPORTER' && msg.sender.organization_name) {
            return msg.sender.organization_name;
        }
        return msg.sender.display_name;
    };

    const getSenderRoleBadge = (msg: Message) => {
        if (!msg.sender) return null;
        if (msg.sender.role === 'SOS') {
            return (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 font-medium">
                    相談者
                </span>
            );
        }
        return (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-600 font-medium">
                サポーター
            </span>
        );
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
            <div className="px-5 py-3 bg-gradient-to-r from-blue-50 to-green-50 border-b border-gray-100">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-base">💬</span>
                        <h3 className="text-sm font-bold text-gray-800">メッセージ</h3>
                        {messages.length > 0 && (
                            <span className="text-[11px] text-gray-400">{messages.length}件</span>
                        )}
                    </div>
                    <button
                        onClick={loadMessages}
                        className="text-xs text-gray-400 hover:text-blue-500 transition-colors"
                        title="更新"
                    >
                        🔄 更新
                    </button>
                </div>
            </div>

            {/* メッセージ一覧 */}
            <div className="h-[360px] overflow-y-auto px-4 py-3 space-y-3 bg-gray-50/50">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <div className="text-3xl mb-2 opacity-50">💬</div>
                        <p className="text-sm text-gray-400">まだメッセージはありません</p>
                        <p className="text-xs text-gray-300 mt-1">
                            最初のメッセージを送って、やり取りを始めましょう
                        </p>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isMe = msg.sender_user_id === currentUserId;

                        return (
                            <div
                                key={msg.id}
                                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[75%] ${isMe
                                            ? 'bg-blue-600 text-white rounded-2xl rounded-br-md'
                                            : 'bg-white text-gray-800 rounded-2xl rounded-bl-md border border-gray-200'
                                        } px-4 py-2.5 shadow-sm`}
                                >
                                    {/* 相手のメッセージには送信者名を表示 */}
                                    {!isMe && (
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <span className="text-xs font-semibold text-gray-700">
                                                {getSenderLabel(msg)}
                                            </span>
                                            {getSenderRoleBadge(msg)}
                                        </div>
                                    )}

                                    <p
                                        className={`text-sm whitespace-pre-wrap leading-relaxed ${isMe ? 'text-white' : 'text-gray-700'
                                            }`}
                                    >
                                        {msg.content}
                                    </p>

                                    <div
                                        className={`text-[10px] mt-1 ${isMe ? 'text-blue-200 text-right' : 'text-gray-400'
                                            }`}
                                    >
                                        {formatTime(msg.created_at)}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={bottomRef} />
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
                    <p className="text-xs text-gray-400">✅ この相談は解決済みです。メッセージ履歴は閲覧できます。</p>
                </div>
            ) : (
                <div className="px-4 py-3 bg-white border-t border-gray-100">
                    <div className="flex items-end gap-2">
                        <textarea
                            ref={textareaRef}
                            value={newMessage}
                            onChange={handleTextareaInput}
                            onKeyDown={handleKeyDown}
                            placeholder="メッセージを入力... (Shift+Enterで改行)"
                            rows={1}
                            className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300
                         placeholder:text-gray-300 bg-gray-50/50 transition-all"
                            style={{ minHeight: '40px', maxHeight: '120px' }}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!newMessage.trim() || isSending}
                            className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-r from-blue-600 to-green-600 
                         text-white flex items-center justify-center
                         hover:from-blue-700 hover:to-green-700 
                         disabled:opacity-40 disabled:cursor-not-allowed
                         transition-all active:scale-95"
                        >
                            {isSending ? (
                                <span className="animate-spin text-sm">⟳</span>
                            ) : (
                                <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                                    />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
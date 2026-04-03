'use client';

import { useEffect, useState } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

type ToastProps = {
    message: string;
    type: ToastType;
    onClose: () => void;
};

const ICONS = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
};

const COLORS = {
    success: 'bg-teal-500',
    error: 'bg-red-500',
    warning: 'bg-orange-500',
    info: 'bg-blue-500',
};

export function Toast({ message, type, onClose }: ToastProps) {
    useEffect(() => {
        const timer = setTimeout(onClose, 4000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className="fixed top-20 right-4 z-50 animate-slide-in-right">
            <div className={`${COLORS[type]} text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px] max-w-md`}>
                <span className="text-2xl flex-shrink-0">{ICONS[type]}</span>
                <p className="flex-1 font-medium text-sm">{message}</p>
                <button
                    onClick={onClose}
                    className="text-white hover:text-gray-200 transition-colors flex-shrink-0 text-xl leading-none"
                >
                    ✕
                </button>
            </div>
        </div>
    );
}

// Toastマネージャー
export function useToast() {
    const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: ToastType }>>([]);

    const showToast = (message: string, type: ToastType = 'info') => {
        // 同じメッセージが既に表示中なら追加しない（重複防止）
        setToasts((prev) => {
            const isDuplicate = prev.some(t => t.message === message && t.type === type);
            if (isDuplicate) return prev;
            const id = Date.now();
            return [...prev, { id, message, type }];
        });
    };

    const removeToast = (id: number) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    const ToastContainer = () => (
        <div className="fixed top-20 right-4 z-[9999] pointer-events-none">
            <div className="flex flex-col gap-2 pointer-events-auto">
                {toasts.map((t, index) => (
                    <div key={t.id} style={{ marginTop: `${index * 4}px` }}>
                        <Toast
                            message={t.message}
                            type={t.type}
                            onClose={() => removeToast(t.id)}
                        />
                    </div>
                ))}
            </div>
        </div>
    );

    return {
        success: (message: string) => showToast(message, 'success'),
        error: (message: string) => showToast(message, 'error'),
        warning: (message: string) => showToast(message, 'warning'),
        info: (message: string) => showToast(message, 'info'),
        ToastContainer,
    };
}
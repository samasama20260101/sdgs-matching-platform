'use client';

import { ReactNode } from 'react';

type ModalProps = {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
    type?: 'info' | 'warning' | 'error';
};

const COLORS = {
    info: 'text-blue-600',
    warning: 'text-orange-600',
    error: 'text-red-600',
};

const BG_COLORS = {
    info: 'bg-blue-50',
    warning: 'bg-orange-50',
    error: 'bg-red-50',
};

export function Modal({ isOpen, onClose, title, children, type = 'info' }: ModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* オーバーレイ */}
            <div
                className="absolute inset-0 bg-black bg-opacity-50 animate-fade-in"
                onClick={onClose}
            ></div>

            {/* モーダル本体 */}
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full animate-scale-in">
                {/* ヘッダー */}
                <div className={`${BG_COLORS[type]} px-6 py-4 rounded-t-lg border-b`}>
                    <h3 className={`text-lg font-bold ${COLORS[type]}`}>{title}</h3>
                </div>

                {/* コンテンツ */}
                <div className="px-6 py-4">
                    {children}
                </div>

                {/* 閉じるボタン */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    );
}
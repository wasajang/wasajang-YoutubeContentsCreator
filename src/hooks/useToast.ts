/**
 * useToast — 간단한 전역 토스트 알림 시스템
 *
 * 사용법:
 *   const { showToast } = useToast();
 *   showToast('저장 성공!', 'success');
 *   showToast('저장 실패', 'error');
 */
import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastState {
    toasts: ToastItem[];
    addToast: (message: string, type?: ToastType) => void;
    removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
    toasts: [],

    addToast: (message, type = 'info') => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
        // 3초 후 자동 제거
        setTimeout(() => {
            set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
        }, 3000);
    },

    removeToast: (id) =>
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function useToast() {
    const { addToast } = useToastStore();
    return { showToast: addToast };
}

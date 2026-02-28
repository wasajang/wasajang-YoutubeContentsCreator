/**
 * ToastContainer — 화면 우하단에 토스트 메시지 표시
 */
import React from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useToastStore } from '../hooks/useToast';
import type { ToastType } from '../hooks/useToast';

const ICONS: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle2 size={15} />,
    error:   <AlertCircle size={15} />,
    warning: <AlertTriangle size={15} />,
    info:    <Info size={15} />,
};

const ToastContainer: React.FC = () => {
    const { toasts, removeToast } = useToastStore();

    if (toasts.length === 0) return null;

    return (
        <div className="toast-container">
            {toasts.map((toast) => (
                <div key={toast.id} className={`toast toast--${toast.type}`}>
                    <span className="toast__icon">{ICONS[toast.type]}</span>
                    <span className="toast__message">{toast.message}</span>
                    <button className="toast__close" onClick={() => removeToast(toast.id)}>
                        <X size={12} />
                    </button>
                </div>
            ))}
        </div>
    );
};

export default ToastContainer;

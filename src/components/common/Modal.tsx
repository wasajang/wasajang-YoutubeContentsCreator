import React, { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  actions?: React.ReactNode;
  closeOnBackdrop?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  size = 'md',
  children,
  actions,
  closeOnBackdrop = true,
}) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (closeOnBackdrop && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="common-modal-backdrop" onClick={handleBackdropClick}>
      <div className={`common-modal common-modal--${size}`}>
        {title && (
          <div className="common-modal__header">
            <h3 className="common-modal__title">{title}</h3>
            <button className="common-modal__close" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        )}
        <div className="common-modal__body">{children}</div>
        {actions && (
          <div className="common-modal__actions">{actions}</div>
        )}
      </div>
    </div>
  );
};

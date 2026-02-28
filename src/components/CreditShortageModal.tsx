import React, { useState } from 'react';
import { Coins, X, Gift } from 'lucide-react';
import { useCredits } from '../hooks/useCredits';

interface CreditShortageModalProps {
    isOpen: boolean;
    onClose: () => void;
    requiredCredits: number;
    currentCredits: number;
    actionLabel?: string;
}

const CreditShortageModal: React.FC<CreditShortageModalProps> = ({
    isOpen,
    onClose,
    requiredCredits,
    currentCredits,
    actionLabel,
}) => {
    const { addCredits } = useCredits();
    const [granted, setGranted] = useState(false);

    if (!isOpen) return null;

    const handleTestCredit = () => {
        addCredits(50);
        setGranted(true);
        setTimeout(() => {
            setGranted(false);
            onClose();
        }, 1200);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="credit-shortage-modal" onClick={(e) => e.stopPropagation()}>
                <button className="credit-shortage-modal__close" onClick={onClose}>
                    <X size={16} />
                </button>
                <div className="credit-shortage-modal__icon">
                    <Coins size={32} />
                </div>
                <h3 className="credit-shortage-modal__title">크레딧이 부족합니다</h3>
                <div className="credit-shortage-modal__info">
                    <div className="credit-shortage-modal__row">
                        <span>필요 크레딧</span>
                        <span className="credit-shortage-modal__amount">{requiredCredits}</span>
                    </div>
                    <div className="credit-shortage-modal__row">
                        <span>현재 잔액</span>
                        <span className="credit-shortage-modal__amount credit-shortage-modal__amount--low">
                            {currentCredits}
                        </span>
                    </div>
                    {actionLabel && (
                        <p className="credit-shortage-modal__action">작업: {actionLabel}</p>
                    )}
                </div>
                <p className="credit-shortage-modal__note">
                    결제 시스템 준비 중입니다. 테스트 크레딧을 받아 계속 작업하세요.
                </p>
                <button
                    className="btn-primary credit-shortage-modal__btn"
                    onClick={handleTestCredit}
                    disabled={granted}
                >
                    {granted ? (
                        <><Coins size={14} /> +50 크레딧 지급 완료!</>
                    ) : (
                        <><Gift size={14} /> 테스트 크레딧 50 받기</>
                    )}
                </button>
            </div>
        </div>
    );
};

export default CreditShortageModal;

import React from 'react';
import { Check } from 'lucide-react';
import type { Template } from '../../data/templates';
import { artStyles } from '../../data/artStyles';

export interface PresetConfirmModalProps {
    pendingPreset: Template;
    onConfirm: () => void;
    onCancel: () => void;
}

const PresetConfirmModal: React.FC<PresetConfirmModalProps> = ({
    pendingPreset,
    onConfirm,
    onCancel,
}) => {
    return (
        <div className="preset-confirm-overlay" onClick={onCancel}>
            <div className="preset-confirm-modal" onClick={(e) => e.stopPropagation()}>
                <h3 className="preset-confirm-modal__title">
                    '{pendingPreset.name}' 템플릿 적용
                </h3>
                <p className="preset-confirm-modal__desc">
                    이 템플릿의 설정과 프롬프트 규칙을 모두 적용할까요?
                </p>
                <div className="preset-confirm-modal__info">
                    <div>아트 스타일: {artStyles.find(s => s.id === pendingPreset.artStyleId)?.nameKo || pendingPreset.artStyleId}</div>
                    <div>화면 비율: {pendingPreset.aspectRatio}</div>
                    <div>추천 씬 수: {pendingPreset.promptRules?.sceneSplitRules?.defaultSceneCount || '-'}</div>
                </div>
                <div className="preset-confirm-modal__actions">
                    <button className="btn-secondary" onClick={onCancel}>
                        아니요
                    </button>
                    <button className="btn-primary" onClick={onConfirm}>
                        <Check size={14} /> 예, 적용
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PresetConfirmModal;

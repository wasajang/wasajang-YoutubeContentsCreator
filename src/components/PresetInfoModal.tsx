import React from 'react';
import { X, Film, Ratio, Users, Bot, Mic } from 'lucide-react';
import type { Template } from '../data/templates';
import { getArtStyleById } from '../data/artStyles';
import { useProjectStore } from '../store/projectStore';

interface Props {
    template: Template;
    onApply: () => void;
    onCustomize: () => void;
    onClose: () => void;
}

const ASPECT_RATIO_LABEL: Record<string, string> = {
    '16:9': '16:9 (가로형, 유튜브)',
    '9:16': '9:16 (세로형, Shorts)',
    '1:1': '1:1 (정사각, Instagram)',
};

const PresetInfoModal: React.FC<Props> = ({ template, onApply, onCustomize, onClose }) => {
    const setArtStyleId = useProjectStore((s) => s.setArtStyleId);
    const setAspectRatio = useProjectStore((s) => s.setAspectRatio);
    const setAiModelPreference = useProjectStore((s) => s.setAiModelPreference);

    const handleApply = () => {
        // 템플릿 설정을 store에 반영
        setArtStyleId(template.artStyleId);
        setAspectRatio(template.aspectRatio);
        setAiModelPreference('script', template.defaultModels.script);
        setAiModelPreference('image', template.defaultModels.image);
        setAiModelPreference('video', template.defaultModels.video);
        setAiModelPreference('tts', template.defaultModels.tts);
        onApply();
    };

    return (
        <div className="preset-modal-backdrop" onClick={onClose}>
            <div className="preset-modal" onClick={(e) => e.stopPropagation()}>
                {/* 헤더 */}
                <div className="preset-modal__header">
                    <div className="preset-modal__title-row">
                        <Film size={18} />
                        <h2 className="preset-modal__title">{template.name}</h2>
                        <span className="preset-modal__category">{template.category}</span>
                    </div>
                    <button className="preset-modal__close" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                <p className="preset-modal__desc">{template.description}</p>

                {/* 설정 항목 */}
                <div className="preset-modal__items">
                    <div className="preset-modal__item">
                        <Mic size={14} className="preset-modal__item-icon" />
                        <span className="preset-modal__item-label">제작 방식</span>
                        <span className="preset-modal__item-value">
                            {template.mode === 'narration' ? '나레이션형' : '시네마틱형'}
                        </span>
                    </div>
                    <div className="preset-modal__item">
                        <Ratio size={14} className="preset-modal__item-icon" />
                        <span className="preset-modal__item-label">영상 비율</span>
                        <span className="preset-modal__item-value">
                            {ASPECT_RATIO_LABEL[template.aspectRatio] ?? template.aspectRatio}
                        </span>
                    </div>
                    <div className="preset-modal__item">
                        <Film size={14} className="preset-modal__item-icon" />
                        <span className="preset-modal__item-label">아트 스타일</span>
                        <span className="preset-modal__item-value">
                            {getArtStyleById(template.artStyleId)?.nameKo ?? template.artStyleId}
                        </span>
                    </div>
                    <div className="preset-modal__item">
                        <Users size={14} className="preset-modal__item-icon" />
                        <span className="preset-modal__item-label">추천 캐스트</span>
                        <span className="preset-modal__item-value">
                            배우 {template.castPreset.characters.length}명 ·
                            배경 {template.castPreset.backgrounds.length}개 ·
                            소품 {template.castPreset.items.length}개
                        </span>
                    </div>
                    <div className="preset-modal__item">
                        <Bot size={14} className="preset-modal__item-icon" />
                        <span className="preset-modal__item-label">AI 모델</span>
                        <span className="preset-modal__item-value">
                            {template.defaultModels.image} / {template.defaultModels.video}
                        </span>
                    </div>
                </div>

                <p className="preset-modal__note">
                    ℹ️ 모든 설정은 이후 단계에서 변경할 수 있습니다.
                </p>

                {/* 버튼 */}
                <div className="preset-modal__btns">
                    <button className="btn-secondary" onClick={onCustomize}>
                        직접 설정하기
                    </button>
                    <button className="btn-primary" onClick={handleApply}>
                        프리셋 적용하기
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PresetInfoModal;

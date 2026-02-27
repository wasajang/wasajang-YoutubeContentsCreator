import React from 'react';
import { X, Film, Ratio, Users, Bot } from 'lucide-react';
import type { StylePreset } from '../data/stylePresets';
import { useProjectStore } from '../store/projectStore';

interface Props {
    preset: StylePreset;
    onApply: () => void;
    onCustomize: () => void;
    onClose: () => void;
}

const ASPECT_RATIO_LABEL: Record<string, string> = {
    '16:9': '16:9 (가로형, 유튜브)',
    '9:16': '9:16 (세로형, Shorts)',
    '1:1': '1:1 (정사각, Instagram)',
};

const STYLE_LABEL: Record<string, string> = {
    cinematic: 'Cinematic',
    anime: 'Anime',
    'children-illustration': "Children's Illustration",
    'comic-book': 'Comic Book',
    'oil-painting': 'Oil Painting',
    sketch: 'Sketch',
    cartoon: 'Cartoon',
    watercolor: 'Watercolor',
    '3d-render': '3D Render',
};

const PresetInfoModal: React.FC<Props> = ({ preset, onApply, onCustomize, onClose }) => {
    const setSelectedStyle = useProjectStore((s) => s.setSelectedStyle);
    const setAspectRatio = useProjectStore((s) => s.setAspectRatio);
    const setAiModelPreference = useProjectStore((s) => s.setAiModelPreference);

    const handleApply = () => {
        // 프리셋 설정을 store에 반영
        setSelectedStyle(preset.style);
        setAspectRatio(preset.aspectRatio);
        setAiModelPreference('script', preset.defaultModels.script);
        setAiModelPreference('image', preset.defaultModels.image);
        setAiModelPreference('video', preset.defaultModels.video);
        setAiModelPreference('tts', preset.defaultModels.tts);
        onApply();
    };

    return (
        <div className="preset-modal-backdrop" onClick={onClose}>
            <div className="preset-modal" onClick={(e) => e.stopPropagation()}>
                {/* 헤더 */}
                <div className="preset-modal__header">
                    <div className="preset-modal__title-row">
                        <Film size={18} />
                        <h2 className="preset-modal__title">{preset.name}</h2>
                        <span className="preset-modal__category">{preset.category}</span>
                    </div>
                    <button className="preset-modal__close" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                <p className="preset-modal__desc">{preset.description}</p>

                {/* 설정 항목 */}
                <div className="preset-modal__items">
                    <div className="preset-modal__item">
                        <Ratio size={14} className="preset-modal__item-icon" />
                        <span className="preset-modal__item-label">영상 비율</span>
                        <span className="preset-modal__item-value">
                            {ASPECT_RATIO_LABEL[preset.aspectRatio] ?? preset.aspectRatio}
                        </span>
                    </div>
                    <div className="preset-modal__item">
                        <Film size={14} className="preset-modal__item-icon" />
                        <span className="preset-modal__item-label">기본 스타일</span>
                        <span className="preset-modal__item-value">
                            {STYLE_LABEL[preset.style] ?? preset.style}
                        </span>
                    </div>
                    <div className="preset-modal__item">
                        <Users size={14} className="preset-modal__item-icon" />
                        <span className="preset-modal__item-label">추천 캐스트</span>
                        <span className="preset-modal__item-value">
                            배우 {preset.recommendedCast.characters}명 ·
                            배경 {preset.recommendedCast.backgrounds}개 ·
                            소품 {preset.recommendedCast.items}개
                        </span>
                    </div>
                    <div className="preset-modal__item">
                        <Bot size={14} className="preset-modal__item-icon" />
                        <span className="preset-modal__item-label">AI 모델</span>
                        <span className="preset-modal__item-value">
                            {preset.defaultModels.image} / {preset.defaultModels.video}
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

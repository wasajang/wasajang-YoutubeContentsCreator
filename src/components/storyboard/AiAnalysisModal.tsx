import React from 'react';
import { Sparkles, Loader } from 'lucide-react';

interface CastPreset {
    characters: Array<{ name: string; description?: string }>;
    backgrounds: Array<{ name: string; description?: string }>;
    items: Array<{ name: string; description?: string }>;
}

interface AiAnalysisModalProps {
    isAnalyzing: boolean;
    onAnalyze: (doAnalysis: boolean) => void;
    // 템플릿 분기용 props (optional)
    templateId?: string | null;
    templateName?: string | null;
    castPreset?: CastPreset | null;
}

const AiAnalysisModal: React.FC<AiAnalysisModalProps> = ({
    isAnalyzing,
    onAnalyze,
    templateId,
    templateName,
    castPreset,
}) => {
    const hasTemplate = !!templateId && !!castPreset;

    return (
        <div className="modal-overlay">
            <div className="ai-analysis-modal">
                <div className="ai-analysis-modal__icon">
                    <Sparkles size={32} />
                </div>

                {hasTemplate ? (
                    // 4-A: 템플릿 선택한 유저
                    <>
                        <h3 className="ai-analysis-modal__title">
                            '{templateName}' 템플릿 카드 추천
                        </h3>
                        <p className="ai-analysis-modal__desc">
                            캐릭터 {castPreset!.characters.length}명, 배경 {castPreset!.backgrounds.length}개, 아이템 {castPreset!.items.length}개를 자동 추출/추천합니다.
                        </p>
                        <div className="ai-analysis-cast-preview">
                            {castPreset!.characters.length > 0 && (
                                <div className="ai-analysis-cast-section">
                                    <span className="ai-analysis-cast-label">캐릭터</span>
                                    {castPreset!.characters.map((c) => (
                                        <span key={c.name} className="ai-analysis-cast-tag">{c.name}</span>
                                    ))}
                                </div>
                            )}
                            {castPreset!.backgrounds.length > 0 && (
                                <div className="ai-analysis-cast-section">
                                    <span className="ai-analysis-cast-label">배경</span>
                                    {castPreset!.backgrounds.map((c) => (
                                        <span key={c.name} className="ai-analysis-cast-tag">{c.name}</span>
                                    ))}
                                </div>
                            )}
                            {castPreset!.items.length > 0 && (
                                <div className="ai-analysis-cast-section">
                                    <span className="ai-analysis-cast-label">아이템</span>
                                    {castPreset!.items.map((c) => (
                                        <span key={c.name} className="ai-analysis-cast-tag">{c.name}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    // 4-B: 템플릿 미선택 유저
                    <>
                        <h3 className="ai-analysis-modal__title">AI 대본 분석</h3>
                        <p className="ai-analysis-modal__desc">
                            대본을 분석하여 주요 등장인물(3명), 배경(1개), 아이템(1개)을<br />
                            자동으로 추출합니다. (총 5장 선택, 추가 3장은 수동 추가 가능)
                        </p>
                        <p className="ai-analysis-todo">실제 AI 프롬프트는 추후 입력 예정입니다</p>
                    </>
                )}

                {isAnalyzing ? (
                    <div className="ai-analysis-modal__loading">
                        <Loader size={24} className="animate-spin" />
                        <span>대본 분석 중... 캐릭터 3 + 배경 1 + 아이템 1</span>
                        <div className="ai-analysis-modal__progress-bar">
                            <div className="ai-analysis-modal__progress-fill" />
                        </div>
                    </div>
                ) : (
                    <div className="ai-analysis-modal__actions">
                        <button className="btn-primary" onClick={() => onAnalyze(true)}>
                            <Sparkles size={14} /> {hasTemplate ? '예, AI로 분석하기' : '네, AI로 분석하기'}
                        </button>
                        <button className="btn-secondary" onClick={() => onAnalyze(false)}>
                            {hasTemplate ? '아니오, 기본 카드 사용' : '아니오, 직접 선택'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AiAnalysisModal;

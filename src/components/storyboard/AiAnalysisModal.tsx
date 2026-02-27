import React from 'react';
import { Sparkles, Loader } from 'lucide-react';

interface AiAnalysisModalProps {
    isAnalyzing: boolean;
    onAnalyze: (doAnalysis: boolean) => void;
}

const AiAnalysisModal: React.FC<AiAnalysisModalProps> = ({ isAnalyzing, onAnalyze }) => (
    <div className="modal-overlay">
        <div className="ai-analysis-modal">
            <div className="ai-analysis-modal__icon">
                <Sparkles size={32} />
            </div>
            <h3 className="ai-analysis-modal__title">AI 대본 분석</h3>
            <p className="ai-analysis-modal__desc">
                대본을 분석하여 주요 등장인물(3명), 배경(1개), 아이템(1개)을<br />
                자동으로 추출합니다. (총 5장 선택, 추가 3장은 수동 추가 가능)
            </p>
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
                        <Sparkles size={14} /> 네, AI로 분석하기
                    </button>
                    <button className="btn-secondary" onClick={() => onAnalyze(false)}>
                        아니오, 기본 카드 사용
                    </button>
                </div>
            )}
        </div>
    </div>
);

export default AiAnalysisModal;

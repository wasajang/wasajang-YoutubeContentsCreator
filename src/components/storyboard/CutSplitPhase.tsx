/**
 * CutSplitPhase — 스토리보드 1단계: 대본 컷 분할 확인 단계 UI
 * 좌측: 현재 덱 (DeckPanel), 우측: 컷 리스트
 */
import React from 'react';
import { Film, ChevronLeft, ArrowRight, Pencil, Trash2 } from 'lucide-react';
import type { Scene } from '../../store/projectStore';
import type { UseDeckApi } from '../../hooks/useDeck';
import DeckPanel from './DeckPanel';

interface CutSplitPhaseProps {
    scriptCuts: string[];
    scenes: Scene[];
    videoCountPerScene: Record<string, number>;
    setVideoCountPerScene: React.Dispatch<React.SetStateAction<Record<string, number>>>;
    deckApi: Pick<UseDeckApi, 'deck' | 'deckChars' | 'deckBgs' | 'deckItems' | 'removeFromDeck' | 'handleGenerateAsset'>;
    onPrevPhase: () => void;
    onNextPhase: () => void;
}

const CutSplitPhase: React.FC<CutSplitPhaseProps> = ({
    scriptCuts,
    scenes,
    videoCountPerScene,
    setVideoCountPerScene,
    deckApi,
    onPrevPhase,
    onNextPhase,
}) => (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div className="sb-phase-title">
            <span>1단계: 대본 컷 분할 확인</span>
            <span className="sb-phase-title__progress">{scriptCuts.length}개 컷</span>
        </div>

        {/* 2-컬럼 레이아웃: 덱 패널(좌) + 컷 리스트(우) */}
        <div className="deck-layout" style={{ flex: 1, overflow: 'hidden' }}>
            <DeckPanel
                deck={deckApi.deck}
                deckChars={deckApi.deckChars}
                deckBgs={deckApi.deckBgs}
                deckItems={deckApi.deckItems}
                onRemove={deckApi.removeFromDeck}
                onGenerateAsset={deckApi.handleGenerateAsset}
            />

            <div className="sb-content" style={{ flex: 1, overflowY: 'auto' }}>
                <div className="sb-cut-list">
                    {scriptCuts.map((cut, index) => {
                        const sceneId = scenes[index]?.id || `scene-${index + 1}`;
                        const vc = videoCountPerScene[sceneId] || 1;
                        return (
                            <div key={index} className="sb-cut-card">
                                <div className="sb-cut-card__num">
                                    <span>{String(index + 1).padStart(2, '0')}</span>
                                </div>
                                <div className="sb-cut-card__body">
                                    <p className="sb-cut-card__text">{cut}</p>
                                    <div className="sb-cut-card__meta">
                                        <span>📍 {scenes[index]?.location || 'Unknown'}</span>
                                        <span>🎬 {scenes[index]?.cameraAngle || 'Wide Angle'}</span>
                                    </div>
                                </div>
                                <div className="sb-cut-card__video-count">
                                    <span className="sb-cut-card__video-count-label">
                                        <Film size={11} /> 영상
                                    </span>
                                    <div className="sb-cut-card__video-count-btns">
                                        {[1, 2, 3].map((n) => (
                                            <button
                                                key={n}
                                                className={`sb-cut-card__vc-btn ${vc === n ? 'sb-cut-card__vc-btn--active' : ''}`}
                                                onClick={() => setVideoCountPerScene((prev) => ({ ...prev, [sceneId]: n }))}
                                            >
                                                {n}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="sb-cut-card__actions">
                                    <button className="sb-cut-card__action"><Pencil size={12} /></button>
                                    <button className="sb-cut-card__action"><Trash2 size={12} /></button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>

        <div className="sb-bottom-actions">
            <button className="btn-secondary" onClick={onPrevPhase}>
                <ChevronLeft size={14} /> 이전: 카드 선택
            </button>
            <span className="sb-bottom-actions__info">{scriptCuts.length}개 컷이 분할되었습니다</span>
            <button className="btn-primary sb-bottom-actions__btn" onClick={onNextPhase}>
                다음: 시드 매칭 & 생성 <ArrowRight size={14} />
            </button>
        </div>
    </div>
);

export default CutSplitPhase;

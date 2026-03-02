/**
 * CutSplitPhase — 스토리보드: 대본 컷 분할 확인 단계 UI
 * 좌측: 카드 덱 사이드바, 우측: 컷 리스트 + 일괄 설정 + 이미지 박스
 */
import React from 'react';
import { Film, ChevronLeft, ArrowRight, Pencil, Trash2 } from 'lucide-react';
import type { Scene, AssetCard } from '../../store/projectStore';
import type { UseDeckApi } from '../../hooks/useDeck';

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
}) => {
    // 일괄 영상 개수 설정
    const handleBatchVideoCount = (count: number) => {
        const updated: Record<string, number> = {};
        scenes.forEach(s => { updated[s.id] = count; });
        setVideoCountPerScene(updated);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div className="sb-phase-title">
                <span>1단계: 대본 컷 분할 확인</span>
                <span className="sb-phase-title__progress">{scriptCuts.length}개 컷</span>
            </div>

            {/* 일괄 설정 바 */}
            <div className="cut-split-batch">
                <span className="cut-split-batch__label">일괄 설정:</span>
                <button className="cut-split-batch__btn" onClick={() => handleBatchVideoCount(1)}>모든 컷 1장</button>
                <button className="cut-split-batch__btn" onClick={() => handleBatchVideoCount(2)}>모든 컷 2장</button>
                <button className="cut-split-batch__btn" onClick={() => handleBatchVideoCount(3)}>모든 컷 3장</button>
            </div>

            {/* 2-컬럼 레이아웃: 카드 덱 사이드바(좌) + 컷 리스트(우) */}
            <div className="cut-split-layout" style={{ flex: 1, overflow: 'hidden' }}>
                {/* 좌: 카드 덱 사이드바 */}
                <div className="cut-split-deck-sidebar">
                    <h4 className="cut-split-deck-sidebar__title">선택된 카드 덱</h4>
                    {deckApi.deck.map((card: AssetCard) => (
                        <div key={card.id} className="cut-split-deck-card">
                            {card.imageUrl ? (
                                <img src={card.imageUrl} alt={card.name} className="cut-split-deck-card__img" />
                            ) : (
                                <div className="cut-split-deck-card__placeholder" />
                            )}
                            <div className="cut-split-deck-card__info">
                                <span className="cut-split-deck-card__name">{card.name}</span>
                                <span className="cut-split-deck-card__type">
                                    {card.type === 'character' ? '캐릭터' : card.type === 'background' ? '배경' : '아이템'}
                                </span>
                            </div>
                        </div>
                    ))}
                    {deckApi.deck.length === 0 && (
                        <p className="cut-split-deck-sidebar__empty">선택된 카드가 없습니다</p>
                    )}
                </div>

                {/* 우: 컷 분할 메인 */}
                <div className="cut-split-main">
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
                                            <span>{scenes[index]?.location || 'Unknown'}</span>
                                            <span>{scenes[index]?.cameraAngle || 'Wide Angle'}</span>
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
                                    {/* 이미지 박스 시각화 (세로 배치) */}
                                    <div className="cut-image-boxes cut-image-boxes--vertical">
                                        {Array.from({ length: vc }, (_, i) => (
                                            <div key={i} className="cut-image-box">
                                                <span className="cut-image-box__label">
                                                    {vc > 1 ? `${index + 1}-${i + 1}` : `${index + 1}`}
                                                </span>
                                            </div>
                                        ))}
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
};

export default CutSplitPhase;

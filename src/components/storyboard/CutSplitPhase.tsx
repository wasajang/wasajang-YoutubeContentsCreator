/**
 * CutSplitPhase — 스토리보드: 대본 컷 분할 확인 단계 UI
 * 좌측: 카드 덱 사이드바, 우측: 컷 리스트 + 일괄 설정 + 이미지 박스
 */
import React, { useState } from 'react';
import { Film, ChevronLeft, ArrowRight, Pencil, Trash2, Check, X } from 'lucide-react';
import type { Scene, AssetCard } from '../../store/projectStore';
import { useProjectStore } from '../../store/projectStore';
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
    // scriptCuts is kept in props for backward compat but we use scenes directly
    void scriptCuts;
    const setScenes = useProjectStore((s) => s.setScenes);

    // 편집 상태: 현재 편집 중인 씬 ID와 텍스트
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editText, setEditText] = useState('');

    // 일괄 영상 개수 설정
    const handleBatchVideoCount = (count: number) => {
        const updated: Record<string, number> = {};
        scenes.forEach(s => { updated[s.id] = count; });
        setVideoCountPerScene(updated);
    };

    // 편집 시작
    const handleEditStart = (scene: Scene) => {
        setEditingId(scene.id);
        setEditText(scene.text);
    };

    // 편집 저장
    const handleEditSave = () => {
        if (!editingId) return;
        const updated = scenes.map((s) =>
            s.id === editingId ? { ...s, text: editText.trim() || s.text } : s
        );
        setScenes(updated);
        setEditingId(null);
        setEditText('');
    };

    // 편집 취소
    const handleEditCancel = () => {
        setEditingId(null);
        setEditText('');
    };

    // 씬 삭제 (최소 1개 유지)
    const handleDelete = (sceneId: string) => {
        if (scenes.length <= 1) return;
        const updated = scenes.filter((s) => s.id !== sceneId);
        setScenes(updated);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div className="sb-phase-title">
                <span>1단계: 대본 컷 분할 확인</span>
                <span className="sb-phase-title__progress">{scenes.length}개 컷</span>
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
                        {scenes.map((scene, index) => {
                            const vc = videoCountPerScene[scene.id] || 1;
                            const isEditing = editingId === scene.id;
                            return (
                                <div key={scene.id} className="sb-cut-card">
                                    <div className="sb-cut-card__num">
                                        <span>{String(index + 1).padStart(2, '0')}</span>
                                    </div>
                                    <div className="sb-cut-card__body">
                                        {isEditing ? (
                                            <textarea
                                                className="sb-cut-card__edit-textarea"
                                                value={editText}
                                                onChange={(e) => setEditText(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && e.ctrlKey) handleEditSave();
                                                    if (e.key === 'Escape') handleEditCancel();
                                                }}
                                                autoFocus
                                                rows={3}
                                            />
                                        ) : (
                                            <p className="sb-cut-card__text">{scene.text}</p>
                                        )}
                                        <div className="sb-cut-card__meta">
                                            <span>{scene.location || 'Unknown'}</span>
                                            <span>{scene.cameraAngle || 'Wide Angle'}</span>
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
                                                    onClick={() => setVideoCountPerScene((prev) => ({ ...prev, [scene.id]: n }))}
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
                                        {isEditing ? (
                                            <>
                                                <button className="sb-cut-card__action sb-cut-card__action--save" onClick={handleEditSave} title="저장 (Ctrl+Enter)">
                                                    <Check size={12} />
                                                </button>
                                                <button className="sb-cut-card__action" onClick={handleEditCancel} title="취소 (Esc)">
                                                    <X size={12} />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button className="sb-cut-card__action" onClick={() => handleEditStart(scene)} title="텍스트 편집">
                                                    <Pencil size={12} />
                                                </button>
                                                <button
                                                    className="sb-cut-card__action"
                                                    onClick={() => handleDelete(scene.id)}
                                                    title={scenes.length <= 1 ? '마지막 씬은 삭제할 수 없습니다' : '씬 삭제'}
                                                    disabled={scenes.length <= 1}
                                                    style={{ opacity: scenes.length <= 1 ? 0.3 : 1 }}
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </>
                                        )}
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
                <span className="sb-bottom-actions__info">{scenes.length}개 컷이 분할되었습니다</span>
                <button className="btn-primary sb-bottom-actions__btn" onClick={onNextPhase}>
                    다음: 시드 매칭 & 생성 <ArrowRight size={14} />
                </button>
            </div>
        </div>
    );
};

export default CutSplitPhase;

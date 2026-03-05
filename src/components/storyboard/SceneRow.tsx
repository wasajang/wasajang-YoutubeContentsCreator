import React from 'react';
import {
    RefreshCw, CheckCircle2, Loader, Sparkles, User, MapPin, Sword,
    Play, Video, ChevronRight,
} from 'lucide-react';
import type { AssetCard } from '../../store/projectStore';
import { getSubSceneLabel } from '../../services/prompt-builder';

type SceneGenStatus = 'idle' | 'generating' | 'done';

interface SceneRowProps {
    scene: { id: string; text: string; location: string; cameraAngle: string; imageUrl: string; videoUrl?: string };
    index: number;
    videoCount: number;
    genStatus: SceneGenStatus;
    videoGenStatus: SceneGenStatus;
    isSelected: boolean;
    sceneSeeds: string[];
    /** 서브씬별 씨드맵 — allSceneSeeds[`sceneId-subIdx`] 형태 */
    allSceneSeeds?: Record<string, string[]>;
    deck: AssetCard[];
    promptPrefix: string;
    /** 편집 가능한 프롬프트 (customPrompts에서 전달) */
    imagePrompt?: string;
    videoPrompt?: string;
    onImagePromptChange?: (value: string) => void;
    onVideoPromptChange?: (value: string) => void;
    gradientFallback: string;
    onSelect: () => void;
    /** 서브씬 선택 콜백 (CastStrip 연동) */
    onSelectSub?: (subKey: string) => void;
    /** 현재 선택된 씬/서브씬 키 */
    selectedKey?: string | null;
    onGenerateImage: (sceneId: string) => void;
    onRegenerateVideo: (sceneId: string) => void;
    onToggleSeed: (sceneId: string, cardId: string) => void;
    /** 프롬프트 요약 태그 */
    artStyleLabel?: string;
    aspectRatio?: string;
    seedSummary?: string;
    /** 영상 생성 대상 선택 */
    isSelectedForVideo?: boolean;
    onToggleVideoSelection?: (e?: React.MouseEvent) => void;
    /** 씬별 서브이미지 배열 (videoCount만큼) */
    sceneImages?: string[];
    /** 전체 프롬프트 맵 (서브씬별 키 "sceneId-subIdx" 지원) */
    allPrompts?: Record<string, { image: string; video: string }>;
    /** 서브씬별 프롬프트 업데이트 함수 */
    onSubPromptChange?: (key: string, type: 'image' | 'video', value: string) => void;
    /** Ken Burns 효과 */
    kenBurnsEffect?: string;
    onKenBurnsChange?: (effect: string) => void;
}

const SceneRow: React.FC<SceneRowProps> = ({
    scene, index, videoCount, genStatus, videoGenStatus: vidStatus,
    isSelected, sceneSeeds: seeds, allSceneSeeds, deck, promptPrefix,
    imagePrompt, videoPrompt, onImagePromptChange, onVideoPromptChange,
    gradientFallback, onSelect, onSelectSub, selectedKey, onGenerateImage, onRegenerateVideo, onToggleSeed,
    artStyleLabel, aspectRatio, seedSummary,
    isSelectedForVideo, onToggleVideoSelection, sceneImages,
    allPrompts, onSubPromptChange,
    kenBurnsEffect, onKenBurnsChange,
}) => (
    <React.Fragment>
        {Array.from({ length: videoCount }, (_, subIdx) => (
            <div
                key={`${scene.id}-${subIdx}`}
                className={`sc-row ${isSelected || selectedKey === `${scene.id}-${subIdx}` ? 'sc-row--selected' : ''} ${genStatus === 'done' ? 'sc-row--done' : ''} ${subIdx > 0 ? 'sc-row--sub-row' : ''}`}
                onClick={() => {
                    const vc = videoCount;
                    if (vc > 1 && onSelectSub) {
                        onSelectSub(`${scene.id}-${subIdx}`);
                    } else {
                        onSelect();
                    }
                }}
            >
                {/* Col 1: Image — 서브인덱스별 이미지 표시 */}
                <div className="sc-row__img-col">
                    {(() => {
                        const subImageUrl = sceneImages?.[subIdx] || (subIdx === 0 ? scene.imageUrl : undefined);
                        const subDone = !!(subImageUrl && subImageUrl.length > 0);
                        const isGenerating = genStatus === 'generating' && !subDone;
                        if (subDone) {
                            return (
                                <div className="sc-row__img" style={{ backgroundImage: `url(${subImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                                    <button className="sc-row__regen-overlay-btn" onClick={(e) => { e.stopPropagation(); onGenerateImage(scene.id); }} title="이미지 재생성">
                                        <RefreshCw size={11} /> 재생성
                                    </button>
                                    <span className="sc-row__done-badge"><CheckCircle2 size={12} /></span>
                                </div>
                            );
                        } else if (isGenerating) {
                            return (
                                <div className="sc-row__img sc-row__img--gen"><Loader size={20} className="animate-spin" /><span>생성 중...</span></div>
                            );
                        } else {
                            return (
                                <div className="sc-row__img sc-row__img--empty">
                                    <span className="sc-row__img-num">{String(index + 1).padStart(2, '0')}{videoCount > 1 ? `-${subIdx + 1}` : ''}</span>
                                    <button className="sc-row__gen-btn" onClick={(e) => { e.stopPropagation(); onGenerateImage(scene.id); }}>
                                        <Sparkles size={11} /> 개별 생성
                                    </button>
                                </div>
                            );
                        }
                    })()}
                </div>

                {/* Col 2: Seed Cards */}
                <div className="sc-row__seed-col">
                    {subIdx === 0 ? (
                        <>
                            <div className="sc-row__tags">
                                <span className="sc-row__scene-num">SCENE {String(index + 1).padStart(2, '0')}</span>
                                {videoCount > 1 && <span className="sc-row__video-count-badge">{videoCount}컷</span>}
                            </div>
                            <div className="sc-row__script-label"><Sparkles size={9} /> 참고할 씨드 카드</div>
                            <div className="sc-row__seed-stack sc-row__seed-stack--overlap">
                                {seeds.map((cardId, seedIdx) => {
                                    const card = deck.find(c => c.id === cardId);
                                    if (!card) return null;
                                    return (
                                        <div
                                            key={cardId}
                                            className={`sc-row__seed-card sc-row__seed-card--${card.type} sc-row__seed-card--img-only`}
                                            style={{ zIndex: 10 - seedIdx, marginLeft: seedIdx > 0 ? '-12px' : '0' }}
                                            onClick={(e) => { e.stopPropagation(); onToggleSeed(videoCount > 1 ? `${scene.id}-${subIdx}` : scene.id, cardId); }}
                                            title={`${card.name} #${card.seed} (클릭하여 해제)`}
                                        >
                                            {card.imageUrl ? (
                                                <img src={card.imageUrl} className="sc-row__seed-card__img" alt={card.name} />
                                            ) : (
                                                <div className="sc-row__seed-card__img sc-row__seed-card__img--empty">
                                                    {card.type === 'character' ? <User size={10} /> : card.type === 'background' ? <MapPin size={10} /> : <Sword size={10} />}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {seeds.length === 0 && (
                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>상단 카드를 클릭하여 배정</span>
                                )}
                            </div>
                        </>
                    ) : (() => {
                        const subSeedKey = `${scene.id}-${subIdx}`;
                        const subSeeds = allSceneSeeds?.[subSeedKey] || seeds;
                        return (
                        <div className="sc-row__sub-label">
                            <span>파트 {subIdx + 1}/{videoCount}</span>
                            <div className="sc-row__script-label" style={{ marginTop: 2 }}><Sparkles size={9} /> 참고할 씨드 카드</div>
                            <div className="sc-row__seed-stack sc-row__seed-stack--overlap" style={{ marginTop: 4 }}>
                                {subSeeds.map((cardId, seedIdx) => {
                                    const card = deck.find(c => c.id === cardId);
                                    if (!card) return null;
                                    return (
                                        <div
                                            key={cardId}
                                            className={`sc-row__seed-card sc-row__seed-card--${card.type} sc-row__seed-card--img-only`}
                                            style={{ zIndex: 10 - seedIdx, marginLeft: seedIdx > 0 ? '-12px' : '0', width: 24, height: 24 }}
                                            onClick={(e) => { e.stopPropagation(); onToggleSeed(subSeedKey, cardId); }}
                                            title={`${card.name} (클릭하여 해제)`}
                                        >
                                            {card.imageUrl ? (
                                                <img src={card.imageUrl} className="sc-row__seed-card__img" alt={card.name} />
                                            ) : (
                                                <div className="sc-row__seed-card__img sc-row__seed-card__img--empty">
                                                    {card.type === 'character' ? <User size={8} /> : card.type === 'background' ? <MapPin size={8} /> : <Sword size={8} />}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {subSeeds.length === 0 && (
                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>상단 카드를 클릭하여 배정</span>
                                )}
                            </div>
                        </div>
                        );
                    })()}
                </div>

                {/* Col 3: Script */}
                <div className="sc-row__script-col">
                    {subIdx === 0 ? (
                        <>
                            <div className="sc-row__script-label"><Sparkles size={9} /> 대본</div>
                            <p className="sc-row__text">{scene.text}</p>
                        </>
                    ) : (
                        <p className="sc-row__text" style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.75rem' }}>
                            (파트 {subIdx + 1} 대본)
                        </p>
                    )}
                </div>

                {/* Col 4: Prompts (편집 가능, 서브씬별 변형 지원) */}
                <div className="sc-row__prompt-col">
                    {(artStyleLabel || aspectRatio || seedSummary) && (
                        <div className="sc-row__prompt-tags">
                            {artStyleLabel && <span className="sc-row__prompt-tag">{artStyleLabel}</span>}
                            {aspectRatio && <span className="sc-row__prompt-tag">{aspectRatio}</span>}
                            {seedSummary && <span className="sc-row__prompt-tag">{seedSummary}</span>}
                        </div>
                    )}
                    {/* 서브씬 변형 라벨 */}
                    {videoCount > 1 && (
                        <div className="sc-row__variation-label">
                            자동 변형: {getSubSceneLabel(subIdx, videoCount) || `파트 ${subIdx + 1}`}
                        </div>
                    )}
                    {(() => {
                        // 서브씬별 프롬프트 키: "sceneId-subIdx" (서브씬 있을 때) 또는 "sceneId"
                        const subKey = videoCount > 1 ? `${scene.id}-${subIdx}` : scene.id;
                        const subImagePrompt = allPrompts?.[subKey]?.image || imagePrompt || '';
                        const subVideoPrompt = allPrompts?.[subKey]?.video || videoPrompt || '';
                        const canEdit = !!onSubPromptChange || !!onImagePromptChange;
                        return (
                            <>
                                <div className="sc-row__prompt-section">
                                    <div className="sc-row__prompt-label">🖼 이미지 생성 프롬프트</div>
                                    {canEdit ? (
                                        <textarea
                                            className="sc-row__prompt-textarea"
                                            value={subImagePrompt}
                                            onChange={(e) => {
                                                e.stopPropagation();
                                                if (onSubPromptChange) onSubPromptChange(subKey, 'image', e.target.value);
                                                else if (onImagePromptChange) onImagePromptChange(e.target.value);
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            placeholder="AI 분석 후 자동 채워집니다..."
                                            rows={3}
                                        />
                                    ) : (
                                        <p className="sc-row__prompt-text">
                                            <span className="sc-row__prompt-prefix">{promptPrefix}</span>{' '}
                                            {subImagePrompt || '—'}
                                        </p>
                                    )}
                                </div>
                                <div className="sc-row__prompt-divider" />
                                <div className="sc-row__prompt-section">
                                    <div className="sc-row__prompt-label">🎬 영상 생성 프롬프트</div>
                                    {canEdit ? (
                                        <textarea
                                            className="sc-row__prompt-textarea"
                                            value={subVideoPrompt}
                                            onChange={(e) => {
                                                e.stopPropagation();
                                                if (onSubPromptChange) onSubPromptChange(subKey, 'video', e.target.value);
                                                else if (onVideoPromptChange) onVideoPromptChange(e.target.value);
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            placeholder="AI 분석 후 자동 채워집니다..."
                                            rows={3}
                                        />
                                    ) : (
                                        <p className="sc-row__prompt-text">{subVideoPrompt || '—'}</p>
                                    )}
                                </div>
                            </>
                        );
                    })()}
                </div>

                {/* Col 5: Video */}
                <div className="sc-row__video-col">
                    {vidStatus === 'done' ? (
                        <div className="sc-row__video-clip" style={{ backgroundImage: scene.imageUrl ? `url(${scene.imageUrl})` : gradientFallback, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                            <div className="sc-row__video-play"><Play size={18} /></div>
                            <span className="sc-row__video-dur">0:05</span>
                            <button className="sc-row__video-regen" onClick={(e) => { e.stopPropagation(); onRegenerateVideo(scene.id); }} title="영상 재생성">
                                <RefreshCw size={11} /> 재생성
                            </button>
                        </div>
                    ) : vidStatus === 'generating' ? (
                        <div className="sc-row__video-clip sc-row__video-clip--gen">
                            <Loader size={22} className="animate-spin" /><span>영상 생성 중...</span>
                        </div>
                    ) : genStatus === 'done' ? (
                        <div
                            className="sc-row__video-clip sc-row__video-clip--selectable"
                            onClick={(e) => { e.stopPropagation(); onToggleVideoSelection?.(e); }}
                        >
                            <input
                                type="checkbox"
                                checked={!!isSelectedForVideo}
                                readOnly
                                className="sc-row__video-checkbox"
                            />
                            <span>{isSelectedForVideo ? '영상 생성 대상' : '영상 생성 제외'}</span>
                            {/* Ken Burns 효과 드롭다운 */}
                            {onKenBurnsChange && subIdx === 0 && (
                                <select
                                    className="sc-row__ken-burns-select"
                                    value={kenBurnsEffect || 'none'}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => { e.stopPropagation(); onKenBurnsChange(e.target.value); }}
                                >
                                    <option value="none">효과 없음</option>
                                    <option value="zoom-in">줌인</option>
                                    <option value="zoom-out">줌아웃</option>
                                    <option value="pan-lr">패닝 (좌→우)</option>
                                </select>
                            )}
                        </div>
                    ) : (
                        <div className="sc-row__video-clip sc-row__video-clip--empty">
                            <Video size={18} /><span>영상 대기</span>
                        </div>
                    )}
                </div>

                <ChevronRight size={16} className={`sc-row__arrow ${isSelected ? 'sc-row__arrow--open' : ''}`} />
            </div>
        ))}
    </React.Fragment>
);

export default SceneRow;

import React from 'react';
import {
    RefreshCw, CheckCircle2, Loader, Sparkles, User, MapPin, Sword,
    Play, Video, ChevronRight,
} from 'lucide-react';
import type { AssetCard } from '../../store/projectStore';

type SceneGenStatus = 'idle' | 'generating' | 'done';

interface SceneRowProps {
    scene: { id: string; text: string; location: string; cameraAngle: string; imageUrl: string; videoUrl?: string };
    index: number;
    videoCount: number;
    genStatus: SceneGenStatus;
    videoGenStatus: SceneGenStatus;
    isSelected: boolean;
    sceneSeeds: string[];
    deck: AssetCard[];
    promptPrefix: string;
    /** 편집 가능한 프롬프트 (customPrompts에서 전달) */
    imagePrompt?: string;
    videoPrompt?: string;
    onImagePromptChange?: (value: string) => void;
    onVideoPromptChange?: (value: string) => void;
    gradientFallback: string;
    onSelect: () => void;
    onGenerateImage: (sceneId: string) => void;
    onRegenerateVideo: (sceneId: string) => void;
    onToggleSeed: (sceneId: string, cardId: string) => void;
    /** 프롬프트 요약 태그 */
    artStyleLabel?: string;
    aspectRatio?: string;
    seedSummary?: string;
    /** 영상 생성 대상 선택 */
    isSelectedForVideo?: boolean;
    onToggleVideoSelection?: () => void;
}

const SceneRow: React.FC<SceneRowProps> = ({
    scene, index, videoCount, genStatus, videoGenStatus: vidStatus,
    isSelected, sceneSeeds: seeds, deck, promptPrefix,
    imagePrompt, videoPrompt, onImagePromptChange, onVideoPromptChange,
    gradientFallback, onSelect, onGenerateImage, onRegenerateVideo, onToggleSeed,
    artStyleLabel, aspectRatio, seedSummary,
    isSelectedForVideo, onToggleVideoSelection,
}) => (
    <React.Fragment>
        {Array.from({ length: videoCount }, (_, subIdx) => (
            <div
                key={`${scene.id}-${subIdx}`}
                className={`sc-row ${isSelected ? 'sc-row--selected' : ''} ${genStatus === 'done' ? 'sc-row--done' : ''} ${subIdx > 0 ? 'sc-row--sub-row' : ''}`}
                onClick={onSelect}
            >
                {/* Col 1: Image */}
                <div className="sc-row__img-col">
                    {genStatus === 'done' && scene.imageUrl ? (
                        <div className="sc-row__img" style={{ backgroundImage: `url(${scene.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                            <button className="sc-row__regen-overlay-btn" onClick={(e) => { e.stopPropagation(); onGenerateImage(scene.id); }} title="이미지 재생성">
                                <RefreshCw size={11} /> 재생성
                            </button>
                            <span className="sc-row__done-badge"><CheckCircle2 size={12} /></span>
                        </div>
                    ) : genStatus === 'generating' ? (
                        <div className="sc-row__img sc-row__img--gen"><Loader size={20} className="animate-spin" /><span>생성 중...</span></div>
                    ) : (
                        <div className="sc-row__img sc-row__img--empty">
                            <span className="sc-row__img-num">{String(index + 1).padStart(2, '0')}{videoCount > 1 ? `-${subIdx + 1}` : ''}</span>
                            <button className="sc-row__gen-btn" onClick={(e) => { e.stopPropagation(); onGenerateImage(scene.id); }}>
                                <Sparkles size={11} /> 개별 생성
                            </button>
                        </div>
                    )}
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
                                            onClick={(e) => { e.stopPropagation(); onToggleSeed(scene.id, cardId); }}
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
                    ) : (
                        <div className="sc-row__sub-label"><span>파트 {subIdx + 1}/{videoCount}</span></div>
                    )}
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

                {/* Col 4: Prompts (편집 가능) */}
                <div className="sc-row__prompt-col">
                    {(artStyleLabel || aspectRatio || seedSummary) && (
                        <div className="sc-row__prompt-tags">
                            {artStyleLabel && <span className="sc-row__prompt-tag">{artStyleLabel}</span>}
                            {aspectRatio && <span className="sc-row__prompt-tag">{aspectRatio}</span>}
                            {seedSummary && <span className="sc-row__prompt-tag">{seedSummary}</span>}
                        </div>
                    )}
                    <div className="sc-row__prompt-section">
                        <div className="sc-row__prompt-label">🖼 이미지 생성 프롬프트</div>
                        {onImagePromptChange ? (
                            <textarea
                                className="sc-row__prompt-textarea"
                                value={imagePrompt || ''}
                                onChange={(e) => { e.stopPropagation(); onImagePromptChange(e.target.value); }}
                                onClick={(e) => e.stopPropagation()}
                                placeholder="AI 분석 후 자동 채워집니다..."
                                rows={3}
                            />
                        ) : (
                            <p className="sc-row__prompt-text">
                                <span className="sc-row__prompt-prefix">{promptPrefix}</span>{' '}
                                {imagePrompt ?? '—'}
                            </p>
                        )}
                    </div>
                    <div className="sc-row__prompt-divider" />
                    <div className="sc-row__prompt-section">
                        <div className="sc-row__prompt-label">🎬 영상 생성 프롬프트</div>
                        {onVideoPromptChange ? (
                            <textarea
                                className="sc-row__prompt-textarea"
                                value={videoPrompt || ''}
                                onChange={(e) => { e.stopPropagation(); onVideoPromptChange(e.target.value); }}
                                onClick={(e) => e.stopPropagation()}
                                placeholder="AI 분석 후 자동 채워집니다..."
                                rows={3}
                            />
                        ) : (
                            <p className="sc-row__prompt-text">{videoPrompt ?? '—'}</p>
                        )}
                    </div>
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
                            onClick={(e) => { e.stopPropagation(); onToggleVideoSelection?.(); }}
                        >
                            <input
                                type="checkbox"
                                checked={!!isSelectedForVideo}
                                readOnly
                                className="sc-row__video-checkbox"
                            />
                            <span>{isSelectedForVideo ? '영상 생성 대상' : '영상 생성 제외'}</span>
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

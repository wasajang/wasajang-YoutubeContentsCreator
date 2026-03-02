import React from 'react';
import { Film, Loader } from 'lucide-react';

type SceneGenStatus = 'idle' | 'generating' | 'done';

interface SceneFilmstripProps {
    scenes: Array<{ id: string; imageUrl: string }>;
    sceneGenStatus: Record<string, SceneGenStatus>;
    selectedScene: string | null;
    doneCount: number;
    getGradient: (index: number) => string;
    onFrameClick: (sceneId: string) => void;
    /** 씬별 영상 개수 (서브이미지 표시용) */
    videoCountPerScene?: Record<string, number>;
}

const SceneFilmstrip: React.FC<SceneFilmstripProps> = ({
    scenes, sceneGenStatus, selectedScene, doneCount, getGradient, onFrameClick, videoCountPerScene,
}) => {
    if (doneCount === 0) return null;

    // 서브이미지 포함한 전체 프레임 목록 생성
    const frames: Array<{ sceneId: string; sceneIndex: number; subIndex: number; total: number; imageUrl: string }> = [];
    scenes.forEach((scene, i) => {
        const vc = videoCountPerScene?.[scene.id] || 1;
        for (let sub = 0; sub < vc; sub++) {
            frames.push({ sceneId: scene.id, sceneIndex: i, subIndex: sub, total: vc, imageUrl: scene.imageUrl });
        }
    });

    return (
        <div className="filmstrip">
            <div className="filmstrip__header">
                <Film size={14} />
                <span className="filmstrip__title">Story Flow</span>
                <span className="filmstrip__count">{doneCount}/{scenes.length} 씬 · {frames.length} 컷</span>
            </div>
            <div className="filmstrip__row">
                <span className="filmstrip__row-label">🖼️</span>
                <div className="filmstrip__track">
                    {frames.map((frame, i) => {
                        const st = sceneGenStatus[frame.sceneId];
                        const label = frame.total > 1
                            ? `${frame.sceneIndex + 1}-${frame.subIndex + 1}`
                            : String(frame.sceneIndex + 1).padStart(2, '0');
                        return (
                            <div
                                key={`${frame.sceneId}-${frame.subIndex}`}
                                className={`filmstrip__frame ${selectedScene === frame.sceneId ? 'filmstrip__frame--active' : ''} ${st !== 'done' ? 'filmstrip__frame--generating' : ''}`}
                                onClick={() => onFrameClick(frame.sceneId)}
                            >
                                <div
                                    className="filmstrip__frame-img"
                                    style={{
                                        backgroundImage: st === 'done' && frame.imageUrl ? `url(${frame.imageUrl})` : getGradient(i),
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center',
                                    }}
                                >
                                    <span className="filmstrip__frame-num">{label}</span>
                                    {st === 'generating' && <div className="filmstrip__frame-spinner"><Loader size={12} className="animate-spin" /></div>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default SceneFilmstrip;

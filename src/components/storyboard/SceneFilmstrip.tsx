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
}

const SceneFilmstrip: React.FC<SceneFilmstripProps> = ({
    scenes, sceneGenStatus, selectedScene, doneCount, getGradient, onFrameClick,
}) => {
    if (doneCount === 0) return null;

    return (
        <div className="filmstrip">
            <div className="filmstrip__header">
                <Film size={14} />
                <span className="filmstrip__title">Story Flow</span>
                <span className="filmstrip__count">{doneCount}/{scenes.length}</span>
            </div>
            <div className="filmstrip__row">
                <span className="filmstrip__row-label">🖼️</span>
                <div className="filmstrip__track">
                    {scenes.map((scene, i) => {
                        const st = sceneGenStatus[scene.id];
                        return (
                            <div
                                key={scene.id}
                                className={`filmstrip__frame ${selectedScene === scene.id ? 'filmstrip__frame--active' : ''} ${st !== 'done' ? 'filmstrip__frame--generating' : ''}`}
                                onClick={() => onFrameClick(scene.id)}
                            >
                                <div
                                    className="filmstrip__frame-img"
                                    style={{
                                        backgroundImage: st === 'done' && scene.imageUrl ? `url(${scene.imageUrl})` : getGradient(i),
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center',
                                    }}
                                >
                                    <span className="filmstrip__frame-num">{String(i + 1).padStart(2, '0')}</span>
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

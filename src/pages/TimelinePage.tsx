import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Play,
    Pause,
    SkipBack,
    SkipForward,
    Camera,
    Download,
    Maximize2,
    Clock,
    Film,
} from 'lucide-react';
import WorkflowSteps from '../components/WorkflowSteps';
import { mockStoryboardScenes } from '../data/mockData';

const TimelinePage: React.FC = () => {
    const navigate = useNavigate();
    const [isPlaying, setIsPlaying] = useState(false);
    const [selectedClipId, setSelectedClipId] = useState<string | null>('scene-1');

    const scenes = mockStoryboardScenes;
    const selectedScene = scenes.find((s) => s.id === selectedClipId) || scenes[0];

    const totalDuration = scenes.length * 5;
    const selectedIndex = scenes.findIndex((s) => s.id === selectedClipId);
    const currentTimeSec = selectedIndex >= 0 ? selectedIndex * 5 : 0;

    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const getSceneGradient = (index: number) => {
        const gradients = [
            'linear-gradient(135deg, #1a0533 0%, #2d1b3d 50%, #0f2027 100%)',
            'linear-gradient(135deg, #0f2027 0%, #1a1a2e 50%, #2d1b3d 100%)',
            'linear-gradient(135deg, #3a2518 0%, #1a0f0a 50%, #2d1b3d 100%)',
            'linear-gradient(135deg, #1e2a3a 0%, #0a1520 50%, #1a0533 100%)',
            'linear-gradient(135deg, #2d1b3d 0%, #3a2518 50%, #0f2027 100%)',
            'linear-gradient(135deg, #1a1a2e 0%, #0f2027 50%, #3a2518 100%)',
        ];
        return gradients[index % gradients.length];
    };

    const progressPercent = totalDuration > 0 ? (currentTimeSec / totalDuration) * 100 : 0;

    return (
        <div className="page-container" style={{ minHeight: 0, height: 'calc(100vh - 56px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div className="storyboard-header">
                <h2 className="storyboard-header__title">강철의 북진 (Steel March North)</h2>
                <div className="storyboard-header__center">
                    <WorkflowSteps currentStep={4} onStepClick={(step) => {
                        switch (step) {
                            case 1: navigate('/project/idea'); break;
                            case 2: navigate('/project/storyboard'); break;
                            case 3: navigate('/project/storyboard'); break;
                            case 4: break; // 이미 여기
                        }
                    }} />
                </div>
                <div className="storyboard-header__right">
                    <button className="export-btn"><Download size={14} /> Export</button>
                </div>
            </div>

            {/* Compact Preview */}
            <div className="tl-preview">
                <div
                    className="tl-preview__screen"
                    style={{
                        backgroundImage: selectedScene?.imageUrl ? `url(${selectedScene.imageUrl})` : getSceneGradient(selectedIndex),
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                    }}
                >
                    {!selectedScene?.imageUrl && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: 'var(--text-muted)' }}>
                            <Camera size={28} />
                            <span style={{ fontSize: '0.75rem' }}>Select a clip</span>
                        </div>
                    )}
                    <div className="tl-preview__overlay">
                        <span className="tl-preview__scene-label">
                            Scene {String(selectedIndex + 1).padStart(2, '0')} — {selectedScene?.cameraAngle}
                        </span>
                        <button className="btn-icon" style={{ color: '#fff' }}><Maximize2 size={14} /></button>
                    </div>
                </div>

                {/* Scene info side panel */}
                <div className="tl-preview__info">
                    <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: 8 }}>
                        <Film size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                        Scene {String(selectedIndex + 1).padStart(2, '0')}
                    </h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 10 }}>
                        {selectedScene?.text}
                    </p>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                        📍 {selectedScene?.location}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 4 }}>
                        🎬 {selectedScene?.cameraAngle}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 4 }}>
                        <Clock size={10} style={{ verticalAlign: 'middle', marginRight: 2 }} /> 5s clip
                    </div>
                </div>
            </div>

            {/* Playback Controls */}
            <div className="timeline-controls">
                <span className="timeline-time">{formatTime(currentTimeSec)}</span>
                <button className="timeline-controls__btn" onClick={() => {
                    const prev = Math.max(0, selectedIndex - 1);
                    setSelectedClipId(scenes[prev].id);
                }}><SkipBack size={16} /></button>
                <button
                    className="timeline-controls__btn timeline-controls__btn--play"
                    onClick={() => setIsPlaying(!isPlaying)}
                >
                    {isPlaying ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: 2 }} />}
                </button>
                <button className="timeline-controls__btn" onClick={() => {
                    const next = Math.min(scenes.length - 1, selectedIndex + 1);
                    setSelectedClipId(scenes[next].id);
                }}><SkipForward size={16} /></button>
                <span className="timeline-time">{formatTime(totalDuration)}</span>
            </div>

            {/* Scrubber */}
            <div className="tl-scrubber">
                <div className="tl-scrubber__bar">
                    <div className="tl-scrubber__progress" style={{ width: `${progressPercent}%` }} />
                    <div className="tl-scrubber__head" style={{ left: `${progressPercent}%` }} />
                    {/* Time markers */}
                    {scenes.map((_, i) => (
                        <div
                            key={i}
                            className="tl-scrubber__marker"
                            style={{ left: `${(i / scenes.length) * 100}%` }}
                        >
                            <span className="tl-scrubber__marker-label">{formatTime(i * 5)}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Horizontal Video Clip Strip */}
            <div className="tl-clip-strip">
                <div className="tl-clip-strip__track">
                    {scenes.map((scene, index) => (
                        <div
                            key={scene.id}
                            className={`tl-clip-card ${selectedClipId === scene.id ? 'tl-clip-card--active' : ''} ${scene.status !== 'done' ? 'tl-clip-card--pending' : ''}`}
                            onClick={() => setSelectedClipId(scene.id)}
                            style={{ minWidth: `${5 * 28}px` }}
                        >
                            <div
                                className="tl-clip-card__thumb"
                                style={{
                                    backgroundImage: scene.imageUrl ? `url(${scene.imageUrl})` : getSceneGradient(index),
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                }}
                            >
                                <span className="tl-clip-card__num">{String(index + 1).padStart(2, '0')}</span>
                                {scene.status === 'done' && (
                                    <div className="tl-clip-card__play"><Play size={12} /></div>
                                )}
                                <span className="tl-clip-card__dur">5s</span>
                            </div>
                            <div className="tl-clip-card__label">{scene.cameraAngle}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default TimelinePage;

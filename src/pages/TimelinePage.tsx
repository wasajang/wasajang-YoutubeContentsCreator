/**
 * TimelinePage — 영상 편집 (자르기 / 이어붙이기 / 순서 변경) + TTS 오디오
 *
 * 기능:
 *  - 클립 선택 & 프리뷰
 *  - 자르기 (Split): 클립을 지정 지점에서 둘로 분할
 *  - 이어붙이기 (Join): 인접한 두 클립을 하나로 병합
 *  - 순서 변경 (Reorder): 클립 위치를 위/아래로 이동
 *  - 삭제: 선택한 클립 제거
 *  - TTS 오디오 생성 (Fish Speech / Mock) — 개별 & 일괄
 */
import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Play, Pause, SkipBack, SkipForward, Camera, Download,
    Maximize2, Clock, Film, Scissors, Merge, ArrowUp, ArrowDown,
    Trash2, Volume2, Plus, Mic, Loader,
} from 'lucide-react';
import WorkflowSteps from '../components/WorkflowSteps';
import { useProjectStore } from '../store/projectStore';
import type { SentenceTiming, Scene } from '../store/projectStore';
import { getTemplateById } from '../data/templates';
import { mockStoryboardScenes } from '../data/mockData';
import { generateTTS } from '../services/ai-tts';
import { useCredits, CREDIT_COSTS } from '../hooks/useCredits';
import { getUserSelectableModels } from '../data/aiModels';
import NarrationVoiceStep from '../components/narration/NarrationVoiceStep';
import NarrationSplitStep from '../components/narration/NarrationSplitStep';
import NarrationVideoStep from '../components/narration/NarrationVideoStep';
import NarrationEditView from '../components/narration/NarrationEditView';

// ── 타임라인 클립 타입 ──
interface TimelineClip {
    id: string;
    sceneId: string;
    label: string;
    text: string;
    location: string;
    cameraAngle: string;
    imageUrl: string;
    duration: number; // 초
    startTime: number; // 타임라인 상의 시작 시간 (초)
    audioUrl?: string; // TTS 오디오 URL
}

const TimelinePage: React.FC = () => {
    const navigate = useNavigate();
    const {
        title, scenes: storeScenes, aiModelPreferences, setAiModelPreference,
        mode, sentenceTimings, setSentenceTimings, narrativeAudioUrl, setNarrativeAudioUrl, setScenes,
        narrationStep, setNarrationStep, templateId,
    } = useProjectStore();

    // store 씬이 없으면 mockData 폴백
    const sourceScenes = storeScenes.length > 0 ? storeScenes : mockStoryboardScenes;

    // ── 클립 목록 상태 (편집 가능) ──
    const [clips, setClips] = useState<TimelineClip[]>(() =>
        sourceScenes.map((s, i) => ({
            id: `clip-${i + 1}`,
            sceneId: s.id,
            label: `Scene ${String(i + 1).padStart(2, '0')}`,
            text: s.text,
            location: s.location,
            cameraAngle: s.cameraAngle,
            imageUrl: s.imageUrl || '',
            duration: 5,
            startTime: i * 5,
        }))
    );

    const [selectedClipId, setSelectedClipId] = useState<string | null>(clips[0]?.id || null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [splitPosition, setSplitPosition] = useState(50); // 0~100%

    // TTS 상태
    const [ttsGenerating, setTtsGenerating] = useState<Record<string, boolean>>({}); // clipId → loading
    const [ttsAllGenerating, setTtsAllGenerating] = useState(false);
    const { remaining: credits, canAfford, spend } = useCredits();

    // 나레이션 모드 — 전체 TTS 생성 상태
    const [narrativeTtsGenerating, setNarrativeTtsGenerating] = useState(false);

    // 나레이션 모드 — 전체 대본 합치기
    const fullScript = storeScenes.map((s) => s.text).join(' ');

    // 나레이션 TTS 생성 핸들러
    const handleNarrativeTTS = useCallback(async () => {
        const text = fullScript.trim();
        if (!text) {
            alert('대본이 없습니다. IdeaPage에서 먼저 대본을 작성해주세요.');
            return;
        }
        // NOTE: 현재 데드 코드 (NarrationVoiceStep이 TTS 직접 처리). 방어적 크레딧 체크.
        if (!canAfford('tts')) {
            alert('크레딧이 부족합니다!');
            return;
        }
        setNarrativeTtsGenerating(true);
        const narrativePreset = templateId ? getTemplateById(templateId) : null;
        try {
            const result = await generateTTS({
                text,
                clipId: 'narrative',
                model: aiModelPreferences.tts,
                voiceId: narrativePreset?.voice?.voiceId,
                speed: narrativePreset?.voice?.speed,
            });
            setNarrativeAudioUrl(result.audioUrl);
            spend('tts');

            // 문장 단위 타이밍 추정 (한국어 4자/초)
            const sentences = text.match(/[^.!?。\n]+[.!?。]?/g) || [text];
            let currentTime = 0;
            const timings: SentenceTiming[] = sentences.filter((s) => s.trim()).map((s, i) => {
                const duration = Math.max(1, s.trim().length / 4);
                const timing: SentenceTiming = {
                    index: i,
                    text: s.trim(),
                    startTime: Math.round(currentTime * 10) / 10,
                    endTime: Math.round((currentTime + duration) * 10) / 10,
                };
                currentTime += duration;
                return timing;
            });
            setSentenceTimings(timings);
        } catch (err) {
            console.error('[NarrativeTTS] 생성 실패:', err);
            alert(`TTS 생성 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
        } finally {
            setNarrativeTtsGenerating(false);
        }
    }, [fullScript, canAfford, spend, aiModelPreferences.tts, templateId, setNarrativeAudioUrl, setSentenceTimings]);

    // 나레이션 모드 — 씬 자동 분할 후 스토리보드로 이동
    const handleAutoSplit = useCallback(() => {
        if (sentenceTimings.length === 0) {
            alert('먼저 TTS를 생성해주세요.');
            return;
        }
        const maxDuration = 5;
        const autoScenes: Scene[] = [];
        let bucket: SentenceTiming[] = [];
        let sceneStart = 0;

        for (const t of sentenceTimings) {
            bucket.push(t);
            if (t.endTime - sceneStart >= maxDuration) {
                autoScenes.push({
                    id: `scene-${autoScenes.length + 1}`,
                    text: bucket.map((b) => b.text).join(' '),
                    location: '',
                    cameraAngle: 'Wide Angle',
                    imageUrl: '',
                    characters: [],
                    status: 'pending',
                    checked: false,
                });
                bucket = [];
                sceneStart = t.endTime;
            }
        }
        if (bucket.length > 0) {
            autoScenes.push({
                id: `scene-${autoScenes.length + 1}`,
                text: bucket.map((b) => b.text).join(' '),
                location: '',
                cameraAngle: 'Wide Angle',
                imageUrl: '',
                characters: [],
                status: 'pending',
                checked: false,
            });
        }
        setScenes(autoScenes);
        navigate('/project/storyboard');
    }, [sentenceTimings, setScenes, navigate]);

    const selectedClip = clips.find((c) => c.id === selectedClipId) || clips[0];
    const selectedIndex = clips.findIndex((c) => c.id === selectedClipId);

    // 시작 시간 재계산
    const recalcStartTimes = (list: TimelineClip[]): TimelineClip[] => {
        let acc = 0;
        return list.map((c) => {
            const updated = { ...c, startTime: acc };
            acc += c.duration;
            return updated;
        });
    };

    const totalDuration = clips.reduce((sum, c) => sum + c.duration, 0);
    const currentTimeSec = selectedClip ? selectedClip.startTime : 0;

    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = Math.round(sec % 60);
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const getSceneGradient = (index: number) => {
        const g = [
            'linear-gradient(135deg, #1a0533, #2d1b3d, #0f2027)',
            'linear-gradient(135deg, #0f2027, #1a1a2e, #2d1b3d)',
            'linear-gradient(135deg, #3a2518, #1a0f0a, #2d1b3d)',
            'linear-gradient(135deg, #1e2a3a, #0a1520, #1a0533)',
            'linear-gradient(135deg, #2d1b3d, #3a2518, #0f2027)',
            'linear-gradient(135deg, #1a1a2e, #0f2027, #3a2518)',
        ];
        return g[index % g.length];
    };

    const progressPercent = totalDuration > 0 ? (currentTimeSec / totalDuration) * 100 : 0;

    // ── 자르기 (Split) ──
    const handleSplit = useCallback(() => {
        if (!selectedClip || selectedClip.duration <= 1) return;
        const splitRatio = splitPosition / 100;
        const dur1 = Math.max(1, Math.round(selectedClip.duration * splitRatio * 10) / 10);
        const dur2 = Math.max(1, Math.round((selectedClip.duration - dur1) * 10) / 10);

        const clip1: TimelineClip = {
            ...selectedClip,
            id: `${selectedClip.id}-a`,
            label: `${selectedClip.label} (A)`,
            duration: dur1,
        };
        const clip2: TimelineClip = {
            ...selectedClip,
            id: `${selectedClip.id}-b`,
            label: `${selectedClip.label} (B)`,
            duration: dur2,
        };

        setClips((prev) => {
            const idx = prev.findIndex((c) => c.id === selectedClip.id);
            const updated = [...prev];
            updated.splice(idx, 1, clip1, clip2);
            return recalcStartTimes(updated);
        });
        setSelectedClipId(clip1.id);
    }, [selectedClip, splitPosition]);

    // ── 이어붙이기 (Join) — 선택 클립 + 다음 클립 병합 ──
    const handleJoin = useCallback(() => {
        if (selectedIndex < 0 || selectedIndex >= clips.length - 1) return;
        const current = clips[selectedIndex];
        const next = clips[selectedIndex + 1];

        const merged: TimelineClip = {
            ...current,
            id: `${current.id}+${next.id}`,
            label: `${current.label} + ${next.label}`,
            text: `${current.text}\n\n${next.text}`,
            duration: current.duration + next.duration,
        };

        setClips((prev) => {
            const updated = [...prev];
            updated.splice(selectedIndex, 2, merged);
            return recalcStartTimes(updated);
        });
        setSelectedClipId(merged.id);
    }, [clips, selectedIndex]);

    // ── 순서 변경 ──
    const handleMove = useCallback((direction: 'up' | 'down') => {
        if (selectedIndex < 0) return;
        const targetIdx = direction === 'up' ? selectedIndex - 1 : selectedIndex + 1;
        if (targetIdx < 0 || targetIdx >= clips.length) return;

        setClips((prev) => {
            const updated = [...prev];
            [updated[selectedIndex], updated[targetIdx]] = [updated[targetIdx], updated[selectedIndex]];
            return recalcStartTimes(updated);
        });
    }, [clips, selectedIndex]);

    // ── 삭제 ──
    const handleDelete = useCallback(() => {
        if (clips.length <= 1) return; // 최소 1개 유지
        setClips((prev) => {
            const updated = prev.filter((c) => c.id !== selectedClipId);
            return recalcStartTimes(updated);
        });
        setSelectedClipId(clips[Math.max(0, selectedIndex - 1)]?.id || clips[0]?.id);
    }, [clips, selectedClipId, selectedIndex]);

    // ── TTS 개별 생성 ──
    const handleGenerateTTS = useCallback(async (clipId: string) => {
        const clip = clips.find((c) => c.id === clipId);
        if (!clip || ttsGenerating[clipId]) return;

        if (!canAfford('tts', 1)) {
            alert('크레딧이 부족합니다!');
            return;
        }

        const activePreset = templateId ? getTemplateById(templateId) : null;

        setTtsGenerating((prev) => ({ ...prev, [clipId]: true }));
        try {
            const result = await generateTTS({
                text: clip.text,
                clipId: clip.id,
                model: aiModelPreferences.tts,
                voiceId: activePreset?.voice?.voiceId,
                speed: activePreset?.voice?.speed,
            });

            spend('tts', 1);

            setClips((prev) =>
                prev.map((c) =>
                    c.id === clipId ? { ...c, audioUrl: result.audioUrl } : c
                )
            );
        } catch (err) {
            console.error('[TTS] 생성 실패:', err);
            alert(`TTS 생성 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
        } finally {
            setTtsGenerating((prev) => ({ ...prev, [clipId]: false }));
        }
    }, [clips, ttsGenerating, canAfford, spend, aiModelPreferences.tts, templateId]);

    // ── TTS 전체 일괄 생성 ──
    const handleGenerateAllTTS = useCallback(async () => {
        const pendingClips = clips.filter((c) => !c.audioUrl);
        if (pendingClips.length === 0) return;

        const totalCost = pendingClips.length * CREDIT_COSTS.tts;
        if (credits < totalCost) {
            alert(`크레딧이 부족합니다! (필요: ${totalCost}, 보유: ${credits})`);
            return;
        }

        setTtsAllGenerating(true);
        let generated = 0;
        const batchPreset = templateId ? getTemplateById(templateId) : null;

        for (const clip of pendingClips) {
            setTtsGenerating((prev) => ({ ...prev, [clip.id]: true }));
            try {
                const result = await generateTTS({
                    text: clip.text,
                    clipId: clip.id,
                    model: aiModelPreferences.tts,
                    voiceId: batchPreset?.voice?.voiceId,
                    speed: batchPreset?.voice?.speed,
                });

                spend('tts', 1);
                generated++;

                setClips((prev) =>
                    prev.map((c) =>
                        c.id === clip.id ? { ...c, audioUrl: result.audioUrl } : c
                    )
                );
            } catch (err) {
                console.error(`[TTS] ${clip.id} 생성 실패:`, err);
            } finally {
                setTtsGenerating((prev) => ({ ...prev, [clip.id]: false }));
            }
        }

        setTtsAllGenerating(false);
        console.log(`[TTS] 전체 생성 완료: ${generated}/${pendingClips.length}`);
    }, [clips, credits, spend, aiModelPreferences.tts, templateId]);

    const ttsCount = clips.filter((c) => c.audioUrl).length;
    const ttsPendingCount = clips.length - ttsCount;

    // ── 나레이션 모드 — 스텝 클릭 시 라우팅 ──
    const handleNarrationMainClick = useCallback((step: number) => {
        const routes: Record<number, string> = {
            1: '/project/idea',
            2: '/project/timeline',
            3: '/project/timeline',
            4: '/project/storyboard',
            5: '/project/storyboard',
            6: '/project/timeline',
            7: '/project/timeline',
            8: '/project/timeline',
        };
        setNarrationStep(step);
        const route = routes[step];
        if (route && route !== '/project/timeline') {
            navigate(route);
        }
    }, [setNarrationStep, navigate]);

    // ── 나레이션 모드 분기 ──
    if (mode === 'narration') {
        // Step 2: Voice (TTS 생성)
        if (narrationStep <= 2) {
            return (
                <div className="page-container">
                    <WorkflowSteps currentMain={2} onMainClick={handleNarrationMainClick} />
                    <NarrationVoiceStep
                        onNext={() => setNarrationStep(3)}
                        onPrev={() => {
                            setNarrationStep(1);
                            navigate('/project/idea');
                        }}
                    />
                </div>
            );
        }
        // Step 3: Split (씬 분할)
        if (narrationStep === 3) {
            return (
                <div className="page-container">
                    <WorkflowSteps currentMain={3} onMainClick={handleNarrationMainClick} />
                    <NarrationSplitStep
                        onNext={() => {
                            setNarrationStep(4);
                            navigate('/project/storyboard');
                        }}
                        onPrev={() => setNarrationStep(2)}
                    />
                </div>
            );
        }
        // Step 6: Video
        if (narrationStep === 6) {
            return (
                <div className="page-container">
                    <WorkflowSteps currentMain={6} onMainClick={handleNarrationMainClick} />
                    <NarrationVideoStep
                        onNext={() => setNarrationStep(7)}
                        onPrev={() => {
                            setNarrationStep(5);
                            navigate('/project/storyboard');
                        }}
                    />
                </div>
            );
        }
        // Step 7: Edit
        if (narrationStep === 7) {
            return (
                <div className="page-container">
                    <WorkflowSteps currentMain={7} onMainClick={handleNarrationMainClick} />
                    <NarrationEditView
                        onNext={() => setNarrationStep(8)}
                        onPrev={() => setNarrationStep(6)}
                    />
                </div>
            );
        }
        // Step 8: Export — placeholder
        if (narrationStep >= 8) {
            return (
                <div className="page-container">
                    <WorkflowSteps currentMain={8} onMainClick={handleNarrationMainClick} />
                    <div className="narration-placeholder">
                        <p>Step 8: 내보내기 (구현 예정)</p>
                    </div>
                </div>
            );
        }
    }

    return (
        <div className="page-container" style={{ minHeight: 0, height: 'calc(100vh - 56px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div className="storyboard-header">
                <h2 className="storyboard-header__title">{title || '강철의 북진'}</h2>
                <div className="storyboard-header__center">
                    <WorkflowSteps
                        currentMain={4}
                        currentSub="timeline"
                        onMainClick={(step) => {
                            switch (step) {
                                case 1: navigate('/project/idea'); break;
                                case 2: navigate('/project/storyboard'); break;
                                case 3: navigate('/project/storyboard'); break;
                                case 4: break;
                            }
                        }}
                    />
                </div>
                <div className="storyboard-header__right">
                    <button className="export-btn" disabled title="추후 지원 예정 — 현재 TTS 오디오 생성까지 이용 가능"><Download size={14} /> Export</button>
                </div>
            </div>

            {/* 나레이션 모드 — TTS 생성 섹션 */}
            {mode === 'narration' && (
                <div className="narration-tts-section">
                    <div className="narration-tts-section__header">
                        <h3 className="narration-tts-section__title">
                            <Mic size={16} /> 나레이션 TTS 생성
                        </h3>
                        <span className="narration-tts-section__desc">
                            전체 대본({storeScenes.length}개 씬)을 하나의 음성으로 생성합니다
                        </span>
                    </div>

                    <div className="narration-tts-section__controls">
                        <div className="ai-model-row">
                            <label className="ai-model-row__label">TTS AI</label>
                            <select
                                className="ai-model-select"
                                value={aiModelPreferences.tts}
                                onChange={(e) => setAiModelPreference('tts', e.target.value)}
                            >
                                {getUserSelectableModels('tts').map((m) => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
                        </div>
                        <button
                            className="btn-primary"
                            onClick={handleNarrativeTTS}
                            disabled={narrativeTtsGenerating || !fullScript.trim()}
                        >
                            {narrativeTtsGenerating ? (
                                <><Loader size={14} className="spin" /> TTS 생성 중...</>
                            ) : narrativeAudioUrl ? (
                                <><Volume2 size={14} /> 재생성</>
                            ) : (
                                <><Mic size={14} /> TTS 생성</>
                            )}
                        </button>
                    </div>

                    {narrativeAudioUrl && (
                        <div className="narration-tts-section__result">
                            <div className="narration-tts-section__audio-badge">
                                <Volume2 size={12} /> 오디오 생성 완료
                            </div>
                            {sentenceTimings.length > 0 && (
                                <>
                                    <div className="narration-tts-timings">
                                        <p className="narration-tts-timings__label">
                                            문장별 타이밍 ({sentenceTimings.length}개)
                                        </p>
                                        <div className="narration-tts-timings__list">
                                            {sentenceTimings.slice(0, 5).map((t) => (
                                                <div key={t.index} className="narration-tts-timing-row">
                                                    <span className="narration-tts-timing-row__time">
                                                        {t.startTime.toFixed(1)}s — {t.endTime.toFixed(1)}s
                                                    </span>
                                                    <span className="narration-tts-timing-row__text">{t.text}</span>
                                                </div>
                                            ))}
                                            {sentenceTimings.length > 5 && (
                                                <div className="narration-tts-timings__more">
                                                    ...외 {sentenceTimings.length - 5}개
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        className="btn-primary narration-tts-section__split-btn"
                                        onClick={handleAutoSplit}
                                    >
                                        씬 자동 분할 → 스토리보드 <ArrowDown size={14} />
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Preview + Info */}
            <div className="tl-preview">
                <div
                    className="tl-preview__screen"
                    style={{
                        backgroundImage: selectedClip?.imageUrl ? `url(${selectedClip.imageUrl})` : getSceneGradient(selectedIndex),
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                    }}
                >
                    {!selectedClip?.imageUrl && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: 'var(--text-muted)' }}>
                            <Camera size={28} />
                            <span style={{ fontSize: '0.75rem' }}>Select a clip</span>
                        </div>
                    )}
                    <div className="tl-preview__overlay">
                        <span className="tl-preview__scene-label">
                            {selectedClip?.label} — {selectedClip?.cameraAngle}
                        </span>
                        <button className="btn-icon" style={{ color: '#fff' }}><Maximize2 size={14} /></button>
                    </div>
                </div>

                {/* Info Panel */}
                <div className="tl-preview__info">
                    <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: 8 }}>
                        <Film size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                        {selectedClip?.label}
                    </h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 10, maxHeight: 60, overflow: 'auto' }}>
                        {selectedClip?.text}
                    </p>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>📍 {selectedClip?.location}</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 4 }}>🎬 {selectedClip?.cameraAngle}</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 4 }}>
                        <Clock size={10} style={{ verticalAlign: 'middle', marginRight: 2 }} /> {selectedClip?.duration}s clip
                    </div>
                    {selectedClip?.audioUrl && (
                        <div style={{ fontSize: '0.6875rem', color: '#a855f7', marginTop: 4 }}>
                            <Volume2 size={10} style={{ verticalAlign: 'middle', marginRight: 2 }} /> TTS 오디오 있음
                        </div>
                    )}
                </div>
            </div>

            {/* Editing Toolbar */}
            <div className="tl-toolbar">
                <div className="tl-toolbar__group">
                    <button
                        className="tl-toolbar__btn"
                        onClick={handleSplit}
                        disabled={!selectedClip || selectedClip.duration <= 1}
                        title="선택 클립을 둘로 자르기"
                    >
                        <Scissors size={13} /> 자르기
                    </button>
                    <div className="tl-toolbar__split-slider" title={`자를 위치: ${splitPosition}%`}>
                        <input
                            type="range"
                            min={10}
                            max={90}
                            value={splitPosition}
                            onChange={(e) => setSplitPosition(Number(e.target.value))}
                            className="tl-toolbar__range"
                        />
                        <span className="tl-toolbar__range-label">{splitPosition}%</span>
                    </div>
                </div>
                <button
                    className="tl-toolbar__btn"
                    onClick={handleJoin}
                    disabled={selectedIndex < 0 || selectedIndex >= clips.length - 1}
                    title="선택 클립 + 다음 클립 이어붙이기"
                >
                    <Merge size={13} /> 이어붙이기
                </button>
                <div className="tl-toolbar__divider" />
                <button className="tl-toolbar__btn" onClick={() => handleMove('up')} disabled={selectedIndex <= 0} title="클립 앞으로 이동">
                    <ArrowUp size={13} /> 앞으로
                </button>
                <button className="tl-toolbar__btn" onClick={() => handleMove('down')} disabled={selectedIndex >= clips.length - 1} title="클립 뒤로 이동">
                    <ArrowDown size={13} /> 뒤로
                </button>
                <div className="tl-toolbar__divider" />
                <button className="tl-toolbar__btn tl-toolbar__btn--danger" onClick={handleDelete} disabled={clips.length <= 1} title="클립 삭제">
                    <Trash2 size={13} /> 삭제
                </button>
                <div className="tl-toolbar__divider" />
                <div className="ai-model-row ai-model-row--compact">
                    <label className="ai-model-row__label">TTS AI</label>
                    <select
                        className="ai-model-select"
                        value={aiModelPreferences.tts}
                        onChange={(e) => setAiModelPreference('tts', e.target.value)}
                    >
                        {getUserSelectableModels('tts').map((m) => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                    </select>
                </div>
                <button
                    className="tl-toolbar__btn tl-toolbar__btn--tts"
                    onClick={handleGenerateAllTTS}
                    disabled={ttsAllGenerating || ttsPendingCount === 0}
                    title={`${ttsPendingCount}개 클립에 TTS 음성 생성 (각 ${CREDIT_COSTS.tts} 크레딧)`}
                >
                    {ttsAllGenerating ? <Loader size={13} className="spin" /> : <Mic size={13} />}
                    {ttsAllGenerating ? 'TTS 생성 중...' : `TTS 전체 생성 (${ttsPendingCount})`}
                </button>
                <div style={{ flex: 1 }} />
                <span className="tl-toolbar__info">
                    {clips.length}개 클립 · 총 {formatTime(totalDuration)}
                    {ttsCount > 0 && ` · 🔊 ${ttsCount}/${clips.length}`}
                </span>
            </div>

            {/* Playback Controls */}
            <div className="timeline-controls">
                <span className="timeline-time">{formatTime(currentTimeSec)}</span>
                <button className="timeline-controls__btn" onClick={() => {
                    const prev = Math.max(0, selectedIndex - 1);
                    setSelectedClipId(clips[prev].id);
                }}><SkipBack size={16} /></button>
                <button
                    className="timeline-controls__btn timeline-controls__btn--play"
                    onClick={() => setIsPlaying(!isPlaying)}
                >
                    {isPlaying ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: 2 }} />}
                </button>
                <button className="timeline-controls__btn" onClick={() => {
                    const next = Math.min(clips.length - 1, selectedIndex + 1);
                    setSelectedClipId(clips[next].id);
                }}><SkipForward size={16} /></button>
                <span className="timeline-time">{formatTime(totalDuration)}</span>
            </div>

            {/* Scrubber */}
            <div className="tl-scrubber">
                <div className="tl-scrubber__bar">
                    <div className="tl-scrubber__progress" style={{ width: `${progressPercent}%` }} />
                    <div className="tl-scrubber__head" style={{ left: `${progressPercent}%` }} />
                    {clips.map((clip) => (
                        <div
                            key={clip.id}
                            className="tl-scrubber__marker"
                            style={{ left: `${(clip.startTime / totalDuration) * 100}%` }}
                        >
                            <span className="tl-scrubber__marker-label">{formatTime(clip.startTime)}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Video Clip Strip */}
            <div className="tl-clip-strip">
                <div className="tl-clip-strip__label">🎬 영상</div>
                <div className="tl-clip-strip__track">
                    {clips.map((clip, index) => (
                        <div
                            key={clip.id}
                            className={`tl-clip-card ${selectedClipId === clip.id ? 'tl-clip-card--active' : ''} ${!clip.imageUrl ? 'tl-clip-card--pending' : ''}`}
                            onClick={() => setSelectedClipId(clip.id)}
                            style={{ minWidth: `${clip.duration * 28}px` }}
                        >
                            <div
                                className="tl-clip-card__thumb"
                                style={{
                                    backgroundImage: clip.imageUrl ? `url(${clip.imageUrl})` : getSceneGradient(index),
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                }}
                            >
                                <span className="tl-clip-card__num">{String(index + 1).padStart(2, '0')}</span>
                                <span className="tl-clip-card__dur">{clip.duration}s</span>
                            </div>
                            <div className="tl-clip-card__label">{clip.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Audio Track Strip */}
            <div className="tl-clip-strip tl-clip-strip--audio">
                <div className="tl-clip-strip__label">🔊 TTS</div>
                <div className="tl-clip-strip__track">
                    {clips.map((clip) => (
                        <div
                            key={`audio-${clip.id}`}
                            className={`tl-audio-card ${clip.audioUrl ? 'tl-audio-card--has-audio' : ''} ${selectedClipId === clip.id ? 'tl-audio-card--active' : ''} ${ttsGenerating[clip.id] ? 'tl-audio-card--loading' : ''}`}
                            onClick={() => {
                                setSelectedClipId(clip.id);
                                if (!clip.audioUrl && !ttsGenerating[clip.id]) {
                                    handleGenerateTTS(clip.id);
                                }
                            }}
                            style={{ minWidth: `${clip.duration * 28}px` }}
                            title={clip.audioUrl ? 'TTS 오디오 생성 완료' : ttsGenerating[clip.id] ? 'TTS 생성 중...' : 'TTS 음성 생성 (클릭)'}
                        >
                            {ttsGenerating[clip.id] ? (
                                <><Loader size={10} className="spin" /> <span>생성중</span></>
                            ) : clip.audioUrl ? (
                                <><Volume2 size={10} /> <span>TTS</span></>
                            ) : (
                                <><Plus size={10} /> <span>추가</span></>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default TimelinePage;

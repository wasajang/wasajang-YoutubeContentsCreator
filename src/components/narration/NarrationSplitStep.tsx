/**
 * NarrationSplitStep — 나레이션 모드 Step 3 (Split)
 *
 * 기능:
 *  - sentenceTimings 기반 씬 자동 분할
 *  - maxDuration 조절 (3/5/7/10초)
 *  - 씬 합치기 / 씬 경계에서 나누기
 *  - 10초 초과 씬 경고 표시
 *  - 완료 시 scenes + narrationClips store 업데이트
 */
import React, { useState, useCallback, useEffect } from 'react';
import { AlertTriangle, Merge, Scissors } from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';
import type { Scene, SentenceTiming, NarrationClip } from '../../store/projectStore';

interface SplitGroup {
    id: string;
    text: string;
    sentences: SentenceTiming[];
    audioStartTime: number;
    audioEndTime: number;
    duration: number;
}

function autoSplit(timings: SentenceTiming[], maxDuration: number = 5): SplitGroup[] {
    if (timings.length === 0) return [];

    const groups: SentenceTiming[][] = [];
    let currentGroup: SentenceTiming[] = [];
    let currentDuration = 0;

    for (const timing of timings) {
        const timingDuration = timing.endTime - timing.startTime;
        if (currentDuration + timingDuration > maxDuration && currentGroup.length > 0) {
            groups.push(currentGroup);
            currentGroup = [timing];
            currentDuration = timingDuration;
        } else {
            currentGroup.push(timing);
            currentDuration += timingDuration;
        }
    }
    if (currentGroup.length > 0) groups.push(currentGroup);

    return groups.map((group, i) => ({
        id: `scene-${i + 1}`,
        text: group.map((s) => s.text).join(' '),
        sentences: group,
        audioStartTime: group[0].startTime,
        audioEndTime: group[group.length - 1].endTime,
        duration: group[group.length - 1].endTime - group[0].startTime,
    }));
}

interface Props {
    onNext: () => void;
    onPrev?: () => void;
}

const MAX_DURATION_OPTIONS = [3, 5, 7, 10] as const;
const WARN_DURATION = 10;

const NarrationSplitStep: React.FC<Props> = ({ onNext, onPrev }) => {
    const sentenceTimings = useProjectStore((s) => s.sentenceTimings);
    const setScenes = useProjectStore((s) => s.setScenes);
    const setNarrationClips = useProjectStore((s) => s.setNarrationClips);
    const setNarrationStep = useProjectStore((s) => s.setNarrationStep);

    const [maxDuration, setMaxDuration] = useState<number>(5);
    const [groups, setGroups] = useState<SplitGroup[]>([]);

    // maxDuration 변경 또는 sentenceTimings 변경 시 자동 재분할
    useEffect(() => {
        if (sentenceTimings.length > 0) {
            setGroups(autoSplit(sentenceTimings, maxDuration));
        }
    }, [sentenceTimings, maxDuration]);

    const totalDuration = groups.length > 0
        ? groups[groups.length - 1].audioEndTime
        : 0;

    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = Math.round(sec % 60);
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const formatDuration = (sec: number) => `${sec.toFixed(1)}s`;

    // 두 그룹 합치기 (index와 index+1)
    const handleMerge = useCallback((index: number) => {
        if (index < 0 || index >= groups.length - 1) return;
        const a = groups[index];
        const b = groups[index + 1];
        const merged: SplitGroup = {
            id: a.id,
            text: `${a.text} ${b.text}`,
            sentences: [...a.sentences, ...b.sentences],
            audioStartTime: a.audioStartTime,
            audioEndTime: b.audioEndTime,
            duration: b.audioEndTime - a.audioStartTime,
        };
        const next = [...groups];
        next.splice(index, 2, merged);
        // id 재부여
        setGroups(next.map((g, i) => ({ ...g, id: `scene-${i + 1}` })));
    }, [groups]);

    // 그룹 중간에서 나누기 (문장 절반 기준)
    const handleSplit = useCallback((index: number) => {
        const group = groups[index];
        if (group.sentences.length < 2) {
            alert('이 씬은 문장이 1개뿐이라 나눌 수 없습니다.');
            return;
        }
        const mid = Math.ceil(group.sentences.length / 2);
        const firstHalf = group.sentences.slice(0, mid);
        const secondHalf = group.sentences.slice(mid);

        const groupA: SplitGroup = {
            id: group.id,
            text: firstHalf.map((s) => s.text).join(' '),
            sentences: firstHalf,
            audioStartTime: firstHalf[0].startTime,
            audioEndTime: firstHalf[firstHalf.length - 1].endTime,
            duration: firstHalf[firstHalf.length - 1].endTime - firstHalf[0].startTime,
        };
        const groupB: SplitGroup = {
            id: group.id,
            text: secondHalf.map((s) => s.text).join(' '),
            sentences: secondHalf,
            audioStartTime: secondHalf[0].startTime,
            audioEndTime: secondHalf[secondHalf.length - 1].endTime,
            duration: secondHalf[secondHalf.length - 1].endTime - secondHalf[0].startTime,
        };

        const next = [...groups];
        next.splice(index, 1, groupA, groupB);
        setGroups(next.map((g, i) => ({ ...g, id: `scene-${i + 1}` })));
    }, [groups]);

    const handleApplyAndNext = useCallback(() => {
        if (groups.length === 0) {
            alert('분할된 씬이 없습니다. TTS를 먼저 생성해주세요.');
            return;
        }

        // scenes 업데이트
        const newScenes: Scene[] = groups.map((g) => ({
            id: g.id,
            text: g.text,
            location: '',
            cameraAngle: 'Wide Angle',
            imageUrl: '',
            characters: [],
            status: 'pending' as const,
            checked: false,
        }));
        setScenes(newScenes);

        // narrationClips 업데이트
        const newClips: NarrationClip[] = groups.map((g, i) => ({
            id: g.id,
            sceneId: g.id,
            text: g.text,
            sentences: g.sentences,
            imageUrl: '',
            videoUrl: '',
            isVideoEnabled: false,
            effect: 'none' as const,
            audioStartTime: g.audioStartTime,
            audioEndTime: g.audioEndTime,
            duration: g.duration,
            order: i,
            isModified: false,
        }));
        setNarrationClips(newClips);
        setNarrationStep(4);

        onNext();
    }, [groups, setScenes, setNarrationClips, setNarrationStep, onNext]);

    if (sentenceTimings.length === 0) {
        return (
            <div className="narration-split-step">
                <div className="narration-split-step__empty">
                    <AlertTriangle size={24} />
                    <p>TTS가 생성되지 않았습니다. Voice 단계로 돌아가서 음성을 먼저 생성해주세요.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="narration-split-step">
            {/* 헤더 + 분할 기준 */}
            <div className="narration-split-step__header">
                <div className="narration-split-step__title-row">
                    <h3 className="narration-split-step__title">
                        씬 분할 결과
                        <span className="narration-split-step__count">{groups.length}개 씬</span>
                    </h3>
                    <div className="narration-split-step__duration-info">
                        총 {formatTime(totalDuration)}
                    </div>
                </div>
                <div className="narration-split-step__controls">
                    <label className="narration-split-step__controls-label">분할 기준 (최대)</label>
                    <div className="narration-split-step__duration-btns">
                        {MAX_DURATION_OPTIONS.map((sec) => (
                            <button
                                key={sec}
                                className={`narration-split-step__duration-btn ${maxDuration === sec ? 'active' : ''}`}
                                onClick={() => setMaxDuration(sec)}
                            >
                                {sec}초
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* 씬 목록 */}
            <div className="narration-split-step__list">
                {groups.map((group, index) => {
                    const isOverDuration = group.duration > WARN_DURATION;
                    return (
                        <div key={group.id} className="narration-split-step__group-wrapper">
                            <div className={`narration-split-step__scene ${isOverDuration ? 'narration-split-step__scene--warn' : ''}`}>
                                <div className="narration-split-step__scene-header">
                                    <span className="narration-split-step__scene-num">
                                        씬 {index + 1}
                                    </span>
                                    <span className={`narration-split-step__scene-duration ${isOverDuration ? 'narration-split-step__scene-duration--warn' : ''}`}>
                                        {formatDuration(group.duration)}
                                        {isOverDuration && (
                                            <span className="narration-split-step__warn-badge">
                                                <AlertTriangle size={10} /> 10초 초과
                                            </span>
                                        )}
                                    </span>
                                    <span className="narration-split-step__scene-time">
                                        {formatTime(group.audioStartTime)} — {formatTime(group.audioEndTime)}
                                    </span>
                                    <button
                                        className="narration-split-step__scene-split-btn"
                                        onClick={() => handleSplit(index)}
                                        disabled={group.sentences.length < 2}
                                        title="이 씬을 절반으로 나누기"
                                    >
                                        <Scissors size={12} /> 나누기
                                    </button>
                                </div>
                                <p className="narration-split-step__scene-text">{group.text}</p>
                                <div className="narration-split-step__sentence-count">
                                    문장 {group.sentences.length}개
                                </div>
                            </div>

                            {/* 씬 경계 (마지막 씬 이후에는 표시 안 함) */}
                            {index < groups.length - 1 && (
                                <div className="narration-split-step__boundary">
                                    <div className="narration-split-step__boundary-line" />
                                    <button
                                        className="narration-split-step__merge-btn"
                                        onClick={() => handleMerge(index)}
                                        title="다음 씬과 합치기"
                                    >
                                        <Merge size={12} /> 합치기
                                    </button>
                                    <div className="narration-split-step__boundary-line" />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* 요약 + 하단 버튼 */}
            <div className="narration-split-step__footer">
                {onPrev && (
                    <button className="btn-secondary" onClick={onPrev}>
                        이전
                    </button>
                )}
                <span className="narration-split-step__footer-info">
                    총 {groups.length}개 씬 · {formatTime(totalDuration)}
                </span>
                <button
                    className="btn-primary"
                    onClick={handleApplyAndNext}
                    disabled={groups.length === 0}
                >
                    다음: 연출 →
                </button>
            </div>
        </div>
    );
};

export default NarrationSplitStep;

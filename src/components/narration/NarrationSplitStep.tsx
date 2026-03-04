/**
 * NarrationSplitStep — 나레이션 모드 Step 3 (Split)
 *
 * 기능:
 *  - sentenceTimings 기반 씬 자동 분할
 *  - maxDuration 조절 (5/6/8/10/15초, 디폴트 5초)
 *  - 씬 합치기 / 씬 경계에서 나누기
 *  - 문장 1개인 씬도 쉼표·중간 지점에서 나누기 가능
 *  - 씬별 미리듣기 (오디오 구간 재생)
 *  - 10초 초과 씬 경고 표시
 *  - 완료 시 scenes + narrationClips store 업데이트
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { AlertTriangle, Merge, Scissors, Play, Pause } from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';
import type { Scene, SentenceTiming, NarrationClip } from '../../store/projectStore';
import { useToast } from '../../hooks/useToast';

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

/**
 * 문장 1개를 쉼표(,) 또는 텍스트 중간 지점에서 2개의 SentenceTiming으로 분리.
 * 타이밍은 글자 수 비율로 추정.
 */
function splitSingleSentence(sentence: SentenceTiming): [SentenceTiming, SentenceTiming] | null {
    const text = sentence.text;
    if (text.length < 4) return null; // 너무 짧으면 분할 불가

    // 쉼표(,)가 있으면 가장 중간에 가까운 쉼표에서 분할
    let splitIdx = -1;
    const midPoint = Math.floor(text.length / 2);
    const commaIndices: number[] = [];
    for (let i = 0; i < text.length; i++) {
        if (text[i] === ',' || text[i] === '，') commaIndices.push(i);
    }
    if (commaIndices.length > 0) {
        // 중간에 가장 가까운 쉼표
        splitIdx = commaIndices.reduce((best, idx) =>
            Math.abs(idx - midPoint) < Math.abs(best - midPoint) ? idx : best
        , commaIndices[0]);
        splitIdx += 1; // 쉼표 포함
    } else {
        // 쉼표 없으면 공백 기준 중간 지점
        const spaces: number[] = [];
        for (let i = 0; i < text.length; i++) {
            if (text[i] === ' ') spaces.push(i);
        }
        if (spaces.length > 0) {
            splitIdx = spaces.reduce((best, idx) =>
                Math.abs(idx - midPoint) < Math.abs(best - midPoint) ? idx : best
            , spaces[0]);
        } else {
            // 공백도 없으면 글자 중간 지점
            splitIdx = midPoint;
        }
    }

    if (splitIdx <= 0 || splitIdx >= text.length) return null;

    const textA = text.slice(0, splitIdx).trim();
    const textB = text.slice(splitIdx).trim();
    if (!textA || !textB) return null;

    // 글자 수 비율로 타이밍 분배
    const totalLen = textA.length + textB.length;
    const ratio = textA.length / totalLen;
    const totalDuration = sentence.endTime - sentence.startTime;
    const midTime = Math.round((sentence.startTime + totalDuration * ratio) * 10) / 10;

    const a: SentenceTiming = {
        index: sentence.index,
        text: textA,
        startTime: sentence.startTime,
        endTime: midTime,
    };
    const b: SentenceTiming = {
        index: sentence.index + 0.5, // 중간 인덱스 (정렬용)
        text: textB,
        startTime: midTime,
        endTime: sentence.endTime,
    };
    return [a, b];
}

interface Props {
    onNext: () => void;
    onPrev?: () => void;
}

const MAX_DURATION_OPTIONS = [5, 6, 8, 10, 15] as const;
// 경고 기준: 사용자가 선택한 maxDuration을 사용 (아래 컴포넌트 내 state)

const NarrationSplitStep: React.FC<Props> = ({ onNext, onPrev }) => {
    const sentenceTimings = useProjectStore((s) => s.sentenceTimings);
    const narrativeAudioUrl = useProjectStore((s) => s.narrativeAudioUrl);
    const setScenes = useProjectStore((s) => s.setScenes);
    const setNarrationClips = useProjectStore((s) => s.setNarrationClips);
    const setNarrationStep = useProjectStore((s) => s.setNarrationStep);
    const { showToast } = useToast();

    const [maxDuration, setMaxDuration] = useState<number>(5);
    const [groups, setGroups] = useState<SplitGroup[]>([]);

    // 미리듣기 상태
    const [playingGroupId, setPlayingGroupId] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const playTimerRef = useRef<number>(0);

    // maxDuration 변경 또는 sentenceTimings 변경 시 자동 재분할
    useEffect(() => {
        if (sentenceTimings.length > 0) {
            setGroups(autoSplit(sentenceTimings, maxDuration));
        }
    }, [sentenceTimings, maxDuration]);

    // 컴포넌트 언마운트 시 오디오 정리
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            if (playTimerRef.current) {
                clearTimeout(playTimerRef.current);
            }
        };
    }, []);

    const totalDuration = groups.length > 0
        ? groups[groups.length - 1].audioEndTime
        : 0;

    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = Math.round(sec % 60);
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const formatDuration = (sec: number) => `${sec.toFixed(1)}s`;

    // 씬별 미리듣기
    const handlePreview = useCallback((group: SplitGroup) => {
        if (!narrativeAudioUrl) {
            showToast('오디오가 없습니다. Voice 단계에서 음성을 먼저 생성해주세요.', 'info');
            return;
        }

        // 이미 재생 중인 같은 그룹이면 정지
        if (playingGroupId === group.id) {
            if (audioRef.current) {
                audioRef.current.pause();
            }
            if (playTimerRef.current) {
                clearTimeout(playTimerRef.current);
            }
            setPlayingGroupId(null);
            return;
        }

        // 기존 재생 중지
        if (audioRef.current) {
            audioRef.current.pause();
        }
        if (playTimerRef.current) {
            clearTimeout(playTimerRef.current);
        }

        const audio = new Audio(narrativeAudioUrl);
        audioRef.current = audio;

        audio.currentTime = group.audioStartTime;
        setPlayingGroupId(group.id);

        // 구간 끝에서 자동 정지
        const playDurationMs = (group.audioEndTime - group.audioStartTime) * 1000;
        playTimerRef.current = window.setTimeout(() => {
            audio.pause();
            setPlayingGroupId(null);
        }, playDurationMs);

        audio.onended = () => {
            setPlayingGroupId(null);
            if (playTimerRef.current) clearTimeout(playTimerRef.current);
        };

        audio.play().catch(() => {
            setPlayingGroupId(null);
            showToast('오디오 재생에 실패했습니다.', 'error');
        });
    }, [narrativeAudioUrl, playingGroupId, showToast]);

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

    // 그룹 나누기 — 문장 2개 이상이면 문장 절반, 1개면 문장 내 분할
    const handleSplit = useCallback((index: number) => {
        const group = groups[index];

        if (group.sentences.length >= 2) {
            // 문장 절반 기준 분할
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
        } else if (group.sentences.length === 1) {
            // 문장 내 분할 (쉼표/중간 지점)
            const result = splitSingleSentence(group.sentences[0]);
            if (!result) {
                showToast('이 문장은 너무 짧아서 나눌 수 없습니다.', 'info');
                return;
            }
            const [sentA, sentB] = result;

            const groupA: SplitGroup = {
                id: group.id,
                text: sentA.text,
                sentences: [sentA],
                audioStartTime: sentA.startTime,
                audioEndTime: sentA.endTime,
                duration: sentA.endTime - sentA.startTime,
            };
            const groupB: SplitGroup = {
                id: group.id,
                text: sentB.text,
                sentences: [sentB],
                audioStartTime: sentB.startTime,
                audioEndTime: sentB.endTime,
                duration: sentB.endTime - sentB.startTime,
            };

            const next = [...groups];
            next.splice(index, 1, groupA, groupB);
            setGroups(next.map((g, i) => ({ ...g, id: `scene-${i + 1}` })));

            showToast('문장 내에서 분할되었습니다.', 'success');
        }
    }, [groups, showToast]);

    const handleApplyAndNext = useCallback(() => {
        if (groups.length === 0) {
            showToast('분할된 씬이 없습니다. TTS를 먼저 생성해주세요.', 'warning');
            return;
        }

        // 재생 중이면 정지
        if (audioRef.current) {
            audioRef.current.pause();
        }
        setPlayingGroupId(null);

        // scenes 업데이트
        const newScenes: Scene[] = groups.map((g) => ({
            id: g.id,
            text: g.text,
            location: '',
            cameraAngle: 'Wide Angle',
            imageUrl: '',
            characters: [],
            status: 'pending' as const,
            checked: true,
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
                    const isOverDuration = group.duration > maxDuration;
                    const isPlaying = playingGroupId === group.id;
                    return (
                        <div key={group.id} className="narration-split-step__group-wrapper">
                            <div className={`narration-split-step__scene ${isOverDuration ? 'narration-split-step__scene--warn' : ''} ${isPlaying ? 'narration-split-step__scene--playing' : ''}`}>
                                <div className="narration-split-step__scene-header">
                                    <span className="narration-split-step__scene-num">
                                        씬 {index + 1}
                                    </span>
                                    <span className={`narration-split-step__scene-duration ${isOverDuration ? 'narration-split-step__scene-duration--warn' : ''}`}>
                                        {formatDuration(group.duration)}
                                        {isOverDuration && (
                                            <span className="narration-split-step__warn-badge">
                                                <AlertTriangle size={10} /> {maxDuration}초 초과
                                            </span>
                                        )}
                                    </span>
                                    <span className="narration-split-step__scene-time">
                                        {formatTime(group.audioStartTime)} — {formatTime(group.audioEndTime)}
                                    </span>
                                    {/* 미리듣기 버튼 */}
                                    <button
                                        className={`narration-split-step__preview-btn ${isPlaying ? 'narration-split-step__preview-btn--playing' : ''}`}
                                        onClick={() => handlePreview(group)}
                                        title={isPlaying ? '정지' : '이 씬 미리듣기'}
                                    >
                                        {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                                        {isPlaying ? '정지' : '듣기'}
                                    </button>
                                    <button
                                        className="narration-split-step__scene-split-btn"
                                        onClick={() => handleSplit(index)}
                                        title={group.sentences.length >= 2 ? '문장 절반으로 나누기' : '쉼표/중간 지점에서 나누기'}
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

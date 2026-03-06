/**
 * NarrationSplitStep — 나레이션 모드 Step 3 (Split)
 *
 * 기능:
 *  - sentenceTimings 기반 씬 자동 분할 (단어 단위 정밀 분할)
 *  - maxDuration 조절 (5/6/8/10/15초, 디폴트 5초)
 *  - 씬 합치기 / 단어 칩 사이 클릭으로 나누기
 *  - 씬별 미리듣기 (오디오 구간 재생)
 *  - 10초 초과 씬 경고 표시
 *  - 완료 시 scenes + narrationClips store 업데이트
 */
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { AlertTriangle, Merge, Play, Pause } from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';
import type { Scene, SentenceTiming, NarrationClip, WordTiming } from '../../store/projectStore';
import { useToast } from '../../hooks/useToast';
import { enrichWithWordTimings } from '../../utils/word-timing';
import VrewClipTokens from '../editor/VrewClipTokens';

interface SplitGroup {
    id: string;
    text: string;
    sentences: SentenceTiming[];
    audioStartTime: number;
    audioEndTime: number;
    duration: number;
}

// ── 헬퍼: 단어 배열에서 원본 문장 구조 재구성 ──
interface TaggedWord extends WordTiming {
    sentenceIdx: number;
}

function rebuildSentences(
    taggedWords: TaggedWord[],
    originalSentences: SentenceTiming[],
): SentenceTiming[] {
    if (taggedWords.length === 0) return [];
    const result: SentenceTiming[] = [];
    let currentSentIdx = taggedWords[0].sentenceIdx;
    let currentWords: TaggedWord[] = [];

    const flush = () => {
        if (currentWords.length === 0) return;
        const orig = originalSentences[currentSentIdx];
        result.push({
            index: orig?.index ?? result.length,
            text: currentWords.map((w) => w.text).join(' '),
            startTime: currentWords[0].startTime,
            endTime: currentWords[currentWords.length - 1].endTime,
            words: currentWords.map((w, i) => ({
                index: i,
                text: w.text,
                startTime: w.startTime,
                endTime: w.endTime,
            })),
        });
    };

    for (const tw of taggedWords) {
        if (tw.sentenceIdx !== currentSentIdx) {
            flush();
            currentSentIdx = tw.sentenceIdx;
            currentWords = [];
        }
        currentWords.push(tw);
    }
    flush();
    return result;
}

// ── 단어 단위 자동 분할 ──
function autoSplitByWords(
    timings: SentenceTiming[],
    maxDuration: number = 5,
): SplitGroup[] {
    const enriched = enrichWithWordTimings(timings);

    // 전체 단어 플랫 배열 + 원본 문장 인덱스 태깅
    const allWords: TaggedWord[] = [];
    enriched.forEach((s, si) => {
        (s.words || []).forEach((w) =>
            allWords.push({ ...w, sentenceIdx: si }),
        );
    });

    if (allWords.length === 0) return [];

    // 탐욕 그룹핑: 누적 시간이 maxDuration 초과 시 새 그룹
    const wordGroups: TaggedWord[][] = [];
    let current: TaggedWord[] = [];
    let groupStart = allWords[0].startTime;

    for (const word of allWords) {
        const groupDuration = word.endTime - groupStart;
        if (groupDuration > maxDuration && current.length > 0) {
            wordGroups.push(current);
            current = [word];
            groupStart = word.startTime;
        } else {
            current.push(word);
        }
    }
    if (current.length > 0) wordGroups.push(current);

    // 단어 그룹 → SplitGroup 변환
    return wordGroups.map((words, i) => {
        const sentences = rebuildSentences(words, enriched);
        return {
            id: `scene-${i + 1}`,
            text: words.map((w) => w.text).join(' '),
            sentences,
            audioStartTime: words[0].startTime,
            audioEndTime: words[words.length - 1].endTime,
            duration: words[words.length - 1].endTime - words[0].startTime,
        };
    });
}

interface Props {
    onNext: () => void;
    onPrev?: () => void;
}

const MAX_DURATION_OPTIONS = [5, 6, 8, 10, 15] as const;

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
    const [currentTime, setCurrentTime] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const playTimerRef = useRef<number>(0);
    const animFrameRef = useRef<number>(0);

    // 단어 타이밍 보강된 sentenceTimings
    const enrichedTimings = useMemo(
        () => enrichWithWordTimings(sentenceTimings),
        [sentenceTimings],
    );

    // maxDuration 변경 또는 sentenceTimings 변경 시 자동 재분할
    useEffect(() => {
        if (enrichedTimings.length > 0) {
            setGroups(autoSplitByWords(enrichedTimings, maxDuration));
        }
    }, [enrichedTimings, maxDuration]);

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
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current);
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

    // 재생 시 currentTime 실시간 업데이트
    const startTimeTracking = useCallback(() => {
        const tick = () => {
            if (audioRef.current) {
                setCurrentTime(audioRef.current.currentTime);
            }
            animFrameRef.current = requestAnimationFrame(tick);
        };
        animFrameRef.current = requestAnimationFrame(tick);
    }, []);

    const stopTimeTracking = useCallback(() => {
        if (animFrameRef.current) {
            cancelAnimationFrame(animFrameRef.current);
            animFrameRef.current = 0;
        }
    }, []);

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
            stopTimeTracking();
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
        stopTimeTracking();

        const audio = new Audio(narrativeAudioUrl);
        audioRef.current = audio;

        audio.currentTime = group.audioStartTime;
        setPlayingGroupId(group.id);
        setCurrentTime(group.audioStartTime);

        // 구간 끝에서 자동 정지
        const playDurationMs = (group.audioEndTime - group.audioStartTime) * 1000;
        playTimerRef.current = window.setTimeout(() => {
            audio.pause();
            stopTimeTracking();
            setPlayingGroupId(null);
        }, playDurationMs);

        audio.onended = () => {
            stopTimeTracking();
            setPlayingGroupId(null);
            if (playTimerRef.current) clearTimeout(playTimerRef.current);
        };

        audio.play().then(() => {
            startTimeTracking();
        }).catch(() => {
            setPlayingGroupId(null);
            showToast('오디오 재생에 실패했습니다.', 'error');
        });
    }, [narrativeAudioUrl, playingGroupId, showToast, startTimeTracking, stopTimeTracking]);

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
        setGroups(next.map((g, i) => ({ ...g, id: `scene-${i + 1}` })));
    }, [groups]);

    // 단어 칩 사이 클릭으로 분할
    const handleSplitAtWord = useCallback((groupIndex: number, globalWordIndex: number) => {
        const group = groups[groupIndex];
        // 그룹 내 전체 단어 flat 배열
        const allWords = group.sentences.flatMap((s) => s.words || []);
        if (globalWordIndex < 0 || globalWordIndex >= allWords.length - 1) return;

        // 분할 지점: globalWordIndex 단어까지가 A, 나머지가 B
        // 원본 문장 인덱스 태깅 재구성
        const taggedWords: TaggedWord[] = [];
        group.sentences.forEach((s, si) => {
            (s.words || []).forEach((w) => taggedWords.push({ ...w, sentenceIdx: si }));
        });

        const wordsA = taggedWords.slice(0, globalWordIndex + 1);
        const wordsB = taggedWords.slice(globalWordIndex + 1);

        if (wordsA.length === 0 || wordsB.length === 0) return;

        const sentencesA = rebuildSentences(wordsA, group.sentences);
        const sentencesB = rebuildSentences(wordsB, group.sentences);

        const groupA: SplitGroup = {
            id: group.id,
            text: wordsA.map((w) => w.text).join(' '),
            sentences: sentencesA,
            audioStartTime: wordsA[0].startTime,
            audioEndTime: wordsA[wordsA.length - 1].endTime,
            duration: wordsA[wordsA.length - 1].endTime - wordsA[0].startTime,
        };
        const groupB: SplitGroup = {
            id: group.id,
            text: wordsB.map((w) => w.text).join(' '),
            sentences: sentencesB,
            audioStartTime: wordsB[0].startTime,
            audioEndTime: wordsB[wordsB.length - 1].endTime,
            duration: wordsB[wordsB.length - 1].endTime - wordsB[0].startTime,
        };

        const next = [...groups];
        next.splice(groupIndex, 1, groupA, groupB);
        setGroups(next.map((g, i) => ({ ...g, id: `scene-${i + 1}` })));
        showToast('단어 사이에서 분할되었습니다.', 'success');
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
        stopTimeTracking();
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
    }, [groups, setScenes, setNarrationClips, setNarrationStep, onNext, stopTimeTracking]);

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
                        <span className="narration-split-step__image-count">≈ {groups.length}개 이미지</span>
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
                                onClick={() => {
                                    if (sec === maxDuration) return;
                                    setMaxDuration(sec);
                                    const newGroups = autoSplitByWords(enrichedTimings, sec);
                                    showToast(
                                        `${sec}초 기준으로 자동 분할: ${newGroups.length}개 씬`,
                                        'info',
                                    );
                                }}
                            >
                                {sec}초
                            </button>
                        ))}
                    </div>
                    <p className="narration-split-step__controls-hint">
                        한 씬의 최대 길이입니다. 짧을수록 씬이 많아지고, 길수록 적어집니다.
                    </p>
                </div>
            </div>

            {/* 씬 목록 */}
            <div className="narration-split-step__list">
                {groups.map((group, index) => {
                    const isOverDuration = group.duration > maxDuration;
                    const isPlaying = playingGroupId === group.id;
                    const groupWords = group.sentences.flatMap((s) => s.words || []);
                    const wordCount = groupWords.length;
                    return (
                        <div key={group.id} className="narration-split-step__group-wrapper">
                            {/* 이미지 슬롯 */}
                            <div className="narration-split-step__image-box">
                                <span className="narration-split-step__image-placeholder">IMG</span>
                            </div>
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
                                        {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                                        {isPlaying ? '정지' : '▶ 듣기'}
                                    </button>
                                </div>

                                {/* 단어 칩 영역 */}
                                <div className="narration-split-step__word-chips">
                                    {wordCount > 0 ? (
                                        <VrewClipTokens
                                            words={groupWords}
                                            currentTime={isPlaying ? currentTime : -1}
                                            clipAudioStart={group.audioStartTime}
                                            clipAudioEnd={group.audioEndTime}
                                            onSplitAfterWord={(wordIdx) => handleSplitAtWord(index, wordIdx)}
                                        />
                                    ) : (
                                        <p className="narration-split-step__scene-text">{group.text}</p>
                                    )}
                                </div>

                                <div className="narration-split-step__sentence-count">
                                    문장 {group.sentences.length}개 · 단어 {wordCount}개
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

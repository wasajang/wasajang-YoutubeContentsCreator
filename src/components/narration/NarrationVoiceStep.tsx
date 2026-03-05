/**
 * NarrationVoiceStep — 나레이션 모드 Step 2 (Voice)
 *
 * 기능:
 *  - 전체 대본 미리보기 (읽기 전용)
 *  - TTS AI 모델 선택
 *  - 문장별 개별 TTS 생성 (병렬 Promise.all) → 실제 오디오 길이로 타이밍 계산
 *  - 생성 완료 후: 전체 미리듣기, 문장별 개별 재생(▶), 문장별 재생성(🔄)
 */
import React, { useState, useCallback } from 'react';
import { Mic, Volume2, Loader, RefreshCw, Play, Pause } from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';
import type { SentenceTiming } from '../../store/projectStore';
import { generateTTS } from '../../services/ai-tts';
import { getTemplateById } from '../../data/templates';
import { useCredits } from '../../hooks/useCredits';
import { getUserSelectableModels } from '../../data/aiModels';
import { useToast } from '../../hooks/useToast';
import { enrichWithWordTimings } from '../../utils/word-timing';

interface Props {
    onNext: () => void;
    onPrev?: () => void;
}

const NarrationVoiceStep: React.FC<Props> = ({ onNext, onPrev }) => {
    const scenes = useProjectStore((s) => s.scenes);
    const narrativeAudioUrl = useProjectStore((s) => s.narrativeAudioUrl);
    const sentenceTimings = useProjectStore((s) => s.sentenceTimings);
    const setNarrativeAudioUrl = useProjectStore((s) => s.setNarrativeAudioUrl);
    const setSentenceTimings = useProjectStore((s) => s.setSentenceTimings);
    const aiModelPreferences = useProjectStore((s) => s.aiModelPreferences);
    const setAiModelPreference = useProjectStore((s) => s.setAiModelPreference);
    const templateId = useProjectStore((s) => s.templateId);

    const { canAfford, spend } = useCredits();
    const { showToast } = useToast();

    const [isGenerating, setIsGenerating] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [audioRef] = useState(() => new Audio());
    // 전체 순차 재생 중인 문장 인덱스
    const [playingSentenceIdx, setPlayingSentenceIdx] = useState<number | null>(null);
    // 문장별 개별 재생 ref
    const sentenceAudioRef = React.useRef<HTMLAudioElement | null>(null);
    const sentenceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    // 재생성 중인 문장 인덱스
    const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);

    // 전체 대본 합치기
    const fullScript = scenes.map((s) => s.text).join(' ');
    const totalChars = fullScript.length;

    // 문장 분리 헬퍼 (공통 사용)
    const splitSentences = (text: string): string[] => {
        const raw = text.match(/[^.!?。\n]+[.!?。]?/g) || [text];
        return raw.filter((s) => s.trim());
    };

    // ── A. 전체 문장별 개별 TTS 생성 ──
    const handleGenerateTTS = useCallback(async () => {
        const text = fullScript.trim();
        if (!text) {
            showToast('대본이 없습니다. Script 단계에서 먼저 대본을 작성해주세요.', 'warning');
            return;
        }
        if (!canAfford('tts')) {
            showToast('크레딧이 부족합니다!', 'warning');
            return;
        }
        if (!spend('tts')) return;

        setIsGenerating(true);
        const activePreset = templateId ? getTemplateById(templateId) : null;

        try {
            // 1. 문장 분리
            const sentences = splitSentences(text);

            // 2. 문장별 개별 TTS 병렬 호출
            const results = await Promise.all(
                sentences.map((s, i) =>
                    generateTTS({
                        text: s.trim(),
                        clipId: `sentence-${i}`,
                        model: aiModelPreferences.tts,
                        voiceId: activePreset?.voice?.voiceId,
                        speed: activePreset?.voice?.speed,
                    })
                )
            );

            // 3. 실제 측정된 오디오 길이로 타이밍 계산
            let currentTime = 0;
            const newTimings: SentenceTiming[] = results.map((r, i) => {
                const timing: SentenceTiming = {
                    index: i,
                    text: sentences[i].trim(),
                    startTime: Math.round(currentTime * 10) / 10,
                    endTime: Math.round((currentTime + r.estimatedDuration) * 10) / 10,
                    audioUrl: r.audioUrl,
                };
                currentTime += r.estimatedDuration;
                return timing;
            });

            // 4. 전체 오디오는 첫 번째 문장 URL을 narrativeAudioUrl로 사용
            //    (전체 순차 재생은 각 문장 audioUrl로 처리)
            setNarrativeAudioUrl(results[0]?.audioUrl || '');
            setSentenceTimings(enrichWithWordTimings(newTimings));

        } catch (err) {
            console.error('[NarrationVoiceStep] TTS 생성 실패:', err);
            showToast(`TTS 생성 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`, 'error');
        } finally {
            setIsGenerating(false);
        }
    }, [fullScript, aiModelPreferences.tts, canAfford, spend, setNarrativeAudioUrl, setSentenceTimings, templateId, showToast]);

    // ── 전체 순차 재생 (각 문장 audioUrl을 순서대로 재생) ──
    const sequentialPlayRef = React.useRef<{ stopped: boolean }>({ stopped: false });

    const handleTogglePlay = useCallback(async () => {
        if (isPlaying) {
            // 정지
            sequentialPlayRef.current.stopped = true;
            audioRef.pause();
            setIsPlaying(false);
            setPlayingSentenceIdx(null);
            return;
        }

        // 문장별 audioUrl이 있으면 순차 재생
        const hasIndividualAudio = sentenceTimings.some((t) => t.audioUrl);
        if (hasIndividualAudio) {
            sequentialPlayRef.current = { stopped: false };
            setIsPlaying(true);

            for (let i = 0; i < sentenceTimings.length; i++) {
                if (sequentialPlayRef.current.stopped) break;
                const t = sentenceTimings[i];
                if (!t.audioUrl) continue;

                setPlayingSentenceIdx(i);
                await new Promise<void>((resolve) => {
                    const audio = new Audio(t.audioUrl!);
                    audioRef.src = t.audioUrl!;
                    audio.play().catch(console.error);
                    audio.onended = () => resolve();
                    audio.onerror = () => resolve();
                    // 강제 정지 감지
                    const check = setInterval(() => {
                        if (sequentialPlayRef.current.stopped) {
                            audio.pause();
                            clearInterval(check);
                            resolve();
                        }
                    }, 100);
                });
            }

            if (!sequentialPlayRef.current.stopped) {
                setIsPlaying(false);
                setPlayingSentenceIdx(null);
            }
        } else if (narrativeAudioUrl) {
            // 폴백: 단일 오디오 URL 재생
            audioRef.src = narrativeAudioUrl;
            audioRef.play().catch(console.error);
            audioRef.onended = () => setIsPlaying(false);
            setIsPlaying(true);
        }
    }, [narrativeAudioUrl, isPlaying, audioRef, sentenceTimings]);

    // ── B. 문장별 개별 재생 버튼 ──
    const handlePlaySentence = useCallback((timing: SentenceTiming, idx: number) => {
        // 기존 재생 중이면 정지
        if (sentenceAudioRef.current) {
            sentenceAudioRef.current.pause();
            sentenceAudioRef.current = null;
        }
        if (sentenceTimerRef.current) {
            clearTimeout(sentenceTimerRef.current);
            sentenceTimerRef.current = null;
        }

        // 같은 문장 재클릭 → 토글 정지
        if (playingSentenceIdx === idx) {
            setPlayingSentenceIdx(null);
            return;
        }

        // 문장별 개별 audioUrl 우선 사용
        const src = timing.audioUrl || narrativeAudioUrl;
        if (!src) return;

        const audio = new Audio(src);
        sentenceAudioRef.current = audio;

        if (timing.audioUrl) {
            // 개별 오디오: 처음부터 재생
            audio.play().catch(console.error);
        } else {
            // 단일 오디오: 구간 재생
            audio.currentTime = timing.startTime;
            audio.play().catch(console.error);
            const durationMs = (timing.endTime - timing.startTime) * 1000;
            sentenceTimerRef.current = setTimeout(() => {
                audio.pause();
                setPlayingSentenceIdx(null);
                sentenceAudioRef.current = null;
            }, durationMs);
        }

        setPlayingSentenceIdx(idx);

        audio.onended = () => {
            setPlayingSentenceIdx(null);
            sentenceAudioRef.current = null;
        };
    }, [narrativeAudioUrl, playingSentenceIdx]);

    // ── B. 문장별 재생성 ──
    const handleRegenerateSentence = useCallback(async (sentenceIndex: number) => {
        const sentence = sentenceTimings[sentenceIndex];
        if (!sentence) return;

        // 크레딧 확인 및 차감 (개별 재생성: 1 크레딧)
        const currentCredits = useProjectStore.getState().credits;
        if (currentCredits < 1) {
            showToast('크레딧이 부족합니다', 'error');
            return;
        }
        if (!useProjectStore.getState().spendCredits(1)) {
            showToast('크레딧 차감 실패', 'error');
            return;
        }

        const activePreset = templateId ? getTemplateById(templateId) : null;
        setRegeneratingIndex(sentenceIndex);

        try {
            const result = await generateTTS({
                text: sentence.text,
                clipId: `sentence-regen-${sentenceIndex}`,
                model: aiModelPreferences.tts,
                voiceId: activePreset?.voice?.voiceId,
                speed: activePreset?.voice?.speed,
            });

            // 이전 Blob URL 해제
            if (sentence.audioUrl) {
                URL.revokeObjectURL(sentence.audioUrl);
            }

            // 타이밍 업데이트: 이 문장 길이가 바뀌면 이후 문장들도 조정
            const newTimings = [...sentenceTimings];
            const oldDuration = sentence.endTime - sentence.startTime;
            const newDuration = result.estimatedDuration;
            const diff = newDuration - oldDuration;

            newTimings[sentenceIndex] = {
                ...sentence,
                endTime: Math.round((sentence.startTime + newDuration) * 10) / 10,
                audioUrl: result.audioUrl,
            };

            // 이후 문장들 시간 조정
            for (let j = sentenceIndex + 1; j < newTimings.length; j++) {
                newTimings[j] = {
                    ...newTimings[j],
                    startTime: Math.round((newTimings[j].startTime + diff) * 10) / 10,
                    endTime: Math.round((newTimings[j].endTime + diff) * 10) / 10,
                };
            }

            setSentenceTimings(newTimings);
            useProjectStore.getState().setSentenceTimings(newTimings);
            showToast(`${sentenceIndex + 1}번째 문장 재생성 완료`, 'success');

        } catch (err) {
            console.error('[NarrationVoiceStep] 문장 재생성 실패:', err);
            showToast(`재생성 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`, 'error');
        } finally {
            setRegeneratingIndex(null);
        }
    }, [sentenceTimings, aiModelPreferences.tts, templateId, setSentenceTimings, showToast]);

    const totalDuration = sentenceTimings.length > 0
        ? sentenceTimings[sentenceTimings.length - 1].endTime
        : 0;

    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = Math.round(sec % 60);
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const hasAudio = narrativeAudioUrl || sentenceTimings.some((t) => t.audioUrl);

    return (
        <div className="narration-voice-step">
            {/* 대본 미리보기 */}
            <div className="narration-voice-step__preview-section">
                <div className="narration-voice-step__preview-meta">
                    <span className="narration-voice-step__preview-meta-label">
                        전체 대본
                    </span>
                    <span className="narration-voice-step__preview-meta-info">
                        {scenes.length}개 씬 · {totalChars}자
                        {totalDuration > 0 && ` · 예상 ${formatTime(totalDuration)}`}
                    </span>
                </div>
                <textarea
                    className="narration-voice-step__preview"
                    value={fullScript}
                    readOnly
                    placeholder="대본이 없습니다. Script 단계로 돌아가서 대본을 작성해주세요."
                />
            </div>

            {/* TTS 모델 선택 & 생성 버튼 */}
            <div className="narration-voice-step__controls">
                <div className="ai-model-row">
                    <label className="ai-model-row__label">TTS AI</label>
                    <select
                        className="ai-model-select"
                        value={aiModelPreferences.tts}
                        onChange={(e) => setAiModelPreference('tts', e.target.value)}
                        disabled={isGenerating}
                    >
                        {getUserSelectableModels('tts').map((m) => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                    </select>
                </div>

                <button
                    className="btn-primary narration-voice-step__generate-btn"
                    onClick={handleGenerateTTS}
                    disabled={isGenerating || !fullScript.trim()}
                >
                    {isGenerating ? (
                        <><Loader size={14} className="spin" /> 음성 생성 중...</>
                    ) : hasAudio ? (
                        <><RefreshCw size={14} /> 재생성</>
                    ) : (
                        <><Mic size={14} /> 음성 생성</>
                    )}
                </button>
            </div>

            {/* 생성 완료 — 미리듣기 + 타이밍 */}
            {hasAudio && (
                <div className="narration-voice-step__result">
                    <div className="narration-voice-step__audio-bar">
                        <div className="narration-voice-step__audio-badge">
                            <Volume2 size={12} /> 오디오 생성 완료
                        </div>
                        <button
                            className="narration-voice-step__play-btn"
                            onClick={handleTogglePlay}
                            title={isPlaying ? '일시정지' : '전체 순차 재생'}
                        >
                            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                            {isPlaying ? '일시정지' : '전체 재생'}
                        </button>
                        {totalDuration > 0 && (
                            <span className="narration-voice-step__duration">
                                총 {formatTime(totalDuration)}
                            </span>
                        )}
                    </div>

                    {sentenceTimings.length > 0 && (
                        <div className="narration-voice-step__timings">
                            <p className="narration-voice-step__timings-label">
                                문장별 타이밍 ({sentenceTimings.length}개)
                            </p>
                            <div className="narration-voice-step__timings-list">
                                {sentenceTimings.map((t, i) => (
                                    <div key={t.index} className="narration-voice-step__timing-row">
                                        {/* 개별 재생 버튼 */}
                                        <button
                                            className={`narration-voice-step__timing-play${playingSentenceIdx === i ? ' narration-voice-step__timing-play--active' : ''}`}
                                            onClick={() => handlePlaySentence(t, i)}
                                            title={playingSentenceIdx === i ? '정지' : '이 문장 듣기'}
                                            disabled={!t.audioUrl && !narrativeAudioUrl}
                                        >
                                            {playingSentenceIdx === i ? <Pause size={10} /> : <Play size={10} />}
                                        </button>

                                        <span className="narration-voice-step__timing-time">
                                            {formatTime(t.startTime)} — {formatTime(t.endTime)}
                                        </span>
                                        <span className="narration-voice-step__timing-text">
                                            {t.text}
                                        </span>

                                        {/* 개별 재생성 버튼 */}
                                        <button
                                            className={`narration-voice-step__timing-regen${regeneratingIndex === i ? ' narration-voice-step__timing-regen--loading' : ''}`}
                                            onClick={() => handleRegenerateSentence(i)}
                                            disabled={isGenerating || regeneratingIndex !== null}
                                            title="이 문장만 재생성"
                                        >
                                            {regeneratingIndex === i
                                                ? <Loader size={10} className="spin" />
                                                : <RefreshCw size={10} />
                                            }
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 하단 버튼 */}
            <div className="narration-voice-step__footer">
                {onPrev && (
                    <button className="btn-secondary" onClick={onPrev}>
                        이전
                    </button>
                )}
                <button
                    className="btn-primary"
                    onClick={onNext}
                    disabled={!hasAudio || sentenceTimings.length === 0}
                    title={!hasAudio ? '먼저 음성을 생성해주세요' : ''}
                >
                    다음: 씬 분할 →
                </button>
            </div>
        </div>
    );
};

export default NarrationVoiceStep;

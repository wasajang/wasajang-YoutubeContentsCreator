/**
 * NarrationVoiceStep — 나레이션 모드 Step 2 (Voice)
 *
 * 기능:
 *  - 전체 대본 미리보기 (읽기 전용)
 *  - TTS AI 모델 선택
 *  - 음성 생성 → audioUrl + sentenceTimings store 저장
 *  - 생성 완료 후: 미리듣기, 문장별 타이밍 표시
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
    const [playingSentenceIdx, setPlayingSentenceIdx] = useState<number | null>(null);
    const sentenceAudioRef = React.useRef<HTMLAudioElement | null>(null);
    const sentenceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    // 전체 대본 합치기
    const fullScript = scenes.map((s) => s.text).join(' ');
    const totalChars = fullScript.length;

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
            const result = await generateTTS({
                text,
                clipId: 'narrative',
                model: aiModelPreferences.tts,
                voiceId: activePreset?.voice?.voiceId,
                speed: activePreset?.voice?.speed,
            });
            setNarrativeAudioUrl(result.audioUrl);

            // 문장 단위 타이밍 추정 (한국어 4자/초)
            const sentences = text.match(/[^.!?。\n]+[.!?。]?/g) || [text];
            let currentTime = 0;
            const timings: SentenceTiming[] = sentences
                .filter((s) => s.trim())
                .map((s, i) => {
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
            setSentenceTimings(enrichWithWordTimings(timings));
        } catch (err) {
            console.error('[NarrationVoiceStep] TTS 생성 실패:', err);
            showToast(`TTS 생성 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`, 'error');
        } finally {
            setIsGenerating(false);
        }
    }, [fullScript, aiModelPreferences.tts, canAfford, spend, setNarrativeAudioUrl, setSentenceTimings, templateId]);

    const handleTogglePlay = useCallback(() => {
        if (!narrativeAudioUrl) return;
        if (isPlaying) {
            audioRef.pause();
            setIsPlaying(false);
        } else {
            audioRef.src = narrativeAudioUrl;
            audioRef.play().catch(console.error);
            audioRef.onended = () => setIsPlaying(false);
            setIsPlaying(true);
        }
    }, [narrativeAudioUrl, isPlaying, audioRef]);

    // 문장별 구간 재생
    const handlePlaySentence = useCallback((timing: SentenceTiming) => {
        if (!narrativeAudioUrl) return;

        // 기존 재생 중이면 정지
        if (sentenceAudioRef.current) {
            sentenceAudioRef.current.pause();
            sentenceAudioRef.current = null;
        }
        if (sentenceTimerRef.current) {
            clearTimeout(sentenceTimerRef.current);
            sentenceTimerRef.current = null;
        }

        // 이미 재생 중인 같은 문장이면 토글 (정지)
        if (playingSentenceIdx === timing.index) {
            setPlayingSentenceIdx(null);
            return;
        }

        const audio = new Audio(narrativeAudioUrl);
        sentenceAudioRef.current = audio;
        audio.currentTime = timing.startTime;
        audio.play().catch(console.error);
        setPlayingSentenceIdx(timing.index);

        // 문장 끝에서 자동 정지
        const durationMs = (timing.endTime - timing.startTime) * 1000;
        sentenceTimerRef.current = setTimeout(() => {
            audio.pause();
            setPlayingSentenceIdx(null);
            sentenceAudioRef.current = null;
        }, durationMs);

        audio.onended = () => {
            setPlayingSentenceIdx(null);
            sentenceAudioRef.current = null;
        };
    }, [narrativeAudioUrl, playingSentenceIdx]);

    const totalDuration = sentenceTimings.length > 0
        ? sentenceTimings[sentenceTimings.length - 1].endTime
        : 0;

    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = Math.round(sec % 60);
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

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
                    ) : narrativeAudioUrl ? (
                        <><RefreshCw size={14} /> 재생성</>
                    ) : (
                        <><Mic size={14} /> 음성 생성</>
                    )}
                </button>
            </div>

            {/* 생성 완료 — 미리듣기 + 타이밍 */}
            {narrativeAudioUrl && (
                <div className="narration-voice-step__result">
                    <div className="narration-voice-step__audio-bar">
                        <div className="narration-voice-step__audio-badge">
                            <Volume2 size={12} /> 오디오 생성 완료
                        </div>
                        <button
                            className="narration-voice-step__play-btn"
                            onClick={handleTogglePlay}
                            title={isPlaying ? '일시정지' : '미리듣기'}
                        >
                            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                            {isPlaying ? '일시정지' : '미리듣기'}
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
                                {sentenceTimings.map((t) => (
                                    <div key={t.index} className="narration-voice-step__timing-row">
                                        <button
                                            className={`narration-voice-step__timing-play${playingSentenceIdx === t.index ? ' narration-voice-step__timing-play--active' : ''}`}
                                            onClick={() => handlePlaySentence(t)}
                                            title={playingSentenceIdx === t.index ? '정지' : '이 문장 듣기'}
                                        >
                                            {playingSentenceIdx === t.index ? <Pause size={10} /> : <Play size={10} />}
                                        </button>
                                        <span className="narration-voice-step__timing-time">
                                            {formatTime(t.startTime)} — {formatTime(t.endTime)}
                                        </span>
                                        <span className="narration-voice-step__timing-text">
                                            {t.text}
                                        </span>
                                        <button
                                            className="narration-voice-step__timing-regen"
                                            onClick={handleGenerateTTS}
                                            disabled={isGenerating}
                                            title="전체 음성 재생성"
                                        >
                                            <RefreshCw size={10} />
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
                    disabled={!narrativeAudioUrl || sentenceTimings.length === 0}
                    title={!narrativeAudioUrl ? '먼저 음성을 생성해주세요' : ''}
                >
                    다음: 씬 분할 →
                </button>
            </div>
        </div>
    );
};

export default NarrationVoiceStep;

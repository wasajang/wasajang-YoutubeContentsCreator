/**
 * EditorPreview — 미리보기 영역
 * NarrationPreview와 동일한 패턴 + 씬 라벨 표시
 * currentWord: 현재 재생 중인 단어 하이라이트 지원
 * videoRef: 비디오 재생을 currentTime/isPlaying과 동기화
 */
import React, { useRef, useEffect } from 'react';
import type { EditorClip } from './types';
import type { WordTiming } from '../../store/projectStore';

interface EditorPreviewProps {
  clip: EditorClip | null;
  currentTime: number;
  isPlaying: boolean;
  currentWord?: WordTiming | null;
}

const EditorPreview: React.FC<EditorPreviewProps> = ({
  clip,
  currentTime,
  isPlaying,
  currentWord,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  // isPlaying 상태에 따라 video play/pause 동기화
  useEffect(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  }, [isPlaying]);

  // currentTime에 따라 video seek 동기화
  useEffect(() => {
    if (!videoRef.current || !clip) return;
    const localTime = currentTime - clip.audioStartTime;
    // 0.3초 이상 차이나면 seek
    if (Math.abs(videoRef.current.currentTime - localTime) > 0.3) {
      videoRef.current.currentTime = Math.max(0, localTime);
    }
  }, [currentTime, clip]);

  if (!clip) {
    return (
      <div className="vrew-preview">
        <div className="vrew-preview__placeholder">
          <span>씬을 선택하세요</span>
        </div>
      </div>
    );
  }

  // 현재 시간에 해당하는 문장 찾기
  let currentSentence = null;
  for (const s of clip.sentences) {
    if (currentTime >= s.startTime && currentTime < s.endTime) {
      currentSentence = s;
      break;
    }
  }

  const isVideo = clip.isVideoEnabled && Boolean(clip.videoUrl);
  const effectClass = clip.effect !== 'none' ? `ken-burns-${clip.effect}` : '';

  // words가 있으면 단어별 렌더링, 없으면 문장 텍스트 표시
  const hasWords =
    currentSentence !== null &&
    Array.isArray(currentSentence.words) &&
    currentSentence.words.length > 0;

  return (
    <div className="vrew-preview">
      <div className="vrew-preview__media">
        {isVideo ? (
          <video
            ref={videoRef}
            className="vrew-preview__video"
            src={clip.videoUrl}
            loop
            muted
            playsInline
          />
        ) : clip.imageUrl ? (
          <div className="vrew-preview__image-wrap">
            <img
              className={`vrew-preview__image${effectClass ? ` ${effectClass}` : ''}`}
              style={{ animationDuration: `${clip.duration}s` }}
              src={clip.imageUrl}
              alt={clip.label}
            />
          </div>
        ) : (
          <div className="vrew-preview__placeholder">
            <span>이미지 없음</span>
          </div>
        )}

        {/* 씬 라벨 */}
        <div className="vrew-preview__label">{clip.label}</div>

        {/* 자막 오버레이 — 단어별 하이라이트 */}
        {currentSentence && (
          <div className="vrew-preview__subtitle">
            {hasWords ? (
              currentSentence.words!.map((word, i) => (
                <span
                  key={`${word.startTime}-${i}`}
                  className={`subtitle-word${
                    currentWord && word.startTime === currentWord.startTime
                      ? ' subtitle-word--active'
                      : ''
                  }`}
                >
                  {word.text}{' '}
                </span>
              ))
            ) : (
              currentSentence.text
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EditorPreview;

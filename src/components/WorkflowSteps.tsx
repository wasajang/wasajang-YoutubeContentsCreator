import React from 'react';
import './WorkflowSteps.css';
import { useProjectStore } from '../store/projectStore';

interface SubStep {
  key: string;
  label: string;
}

interface MainStep {
  num: number;
  label: string;
  route: string;
  subSteps: SubStep[];
}

const CINEMATIC_WORKFLOW: MainStep[] = [
  {
    num: 1, label: 'Idea', route: '/project/idea',
    subSteps: [
      { key: 'script', label: '대본 작성' },
      { key: 'style', label: '스타일 선택' },
    ],
  },
  {
    num: 2, label: 'Storyboard', route: '/project/storyboard',
    subSteps: [
      { key: 'cast-setup', label: '카드 선택' },
      { key: 'cut-split', label: '컷 분할' },
    ],
  },
  {
    num: 3, label: 'Generate', route: '/project/generate',
    subSteps: [
      { key: 'seed-match', label: '시드 매칭' },
      { key: 'image-gen', label: '이미지 생성' },
      { key: 'video-gen', label: '영상 생성' },
    ],
  },
  {
    num: 4, label: 'Animate', route: '/project/timeline',
    subSteps: [
      { key: 'timeline', label: '타임라인' },
      { key: 'tts', label: 'TTS' },
      { key: 'export', label: 'Export' },
    ],
  },
];

/**
 * 나레이션 워크플로우 — 8단계를 4그룹으로 압축
 *
 * Group 1 (대본 & 음성): narrationStep 1,2,3
 * Group 2 (시각화):       narrationStep 4,5
 * Group 3 (영상 & 편집):  narrationStep 6,7
 * Group 4 (내보내기):     narrationStep 8
 */
const NARRATION_WORKFLOW: MainStep[] = [
  {
    num: 1, label: '대본 & 음성', route: '/project/idea',
    subSteps: [
      { key: 'script', label: '대본' },
      { key: 'voice', label: '음성 생성' },
      { key: 'split', label: '씬 분할' },
    ],
  },
  {
    num: 2, label: '시각화', route: '/project/storyboard',
    subSteps: [
      { key: 'cast-setup', label: '카드 선택' },
      { key: 'image-gen', label: '이미지 생성' },
    ],
  },
  {
    num: 3, label: '영상 & 편집', route: '/project/timeline',
    subSteps: [
      { key: 'video', label: '영상화' },
      { key: 'edit', label: '편집' },
    ],
  },
  {
    num: 4, label: '내보내기', route: '/project/timeline',
    subSteps: [
      { key: 'export', label: '내보내기' },
    ],
  },
];

// 유틸 함수는 src/utils/workflow-helpers.ts로 분리됨 (react-refresh 경고 해소)
// 기존 import 경로 호환을 위해 re-export
export { narrationStepToGroup, narrationStepToSubKey } from '../utils/workflow-helpers';

interface Props {
  currentMain: number;       // 1~4
  currentSub?: string;       // 하위 단계 key
  onMainClick?: (step: number) => void;
  onSubClick?: (key: string) => void;
}

const WorkflowSteps: React.FC<Props> = ({ currentMain, currentSub, onMainClick, onSubClick }) => {
  const mode = useProjectStore((s) => s.mode);
  const WORKFLOW = mode === 'narration' ? NARRATION_WORKFLOW : CINEMATIC_WORKFLOW;
  const activeStep = WORKFLOW.find((s) => s.num === currentMain);

  return (
    <div className={`workflow-steps ${mode === 'narration' ? 'workflow-steps--narration' : ''}`}>
      {/* 상위 단계 행 */}
      <div className="workflow-steps__main-row">
        {WORKFLOW.map((step, i) => (
          <React.Fragment key={step.num}>
            <div
              className={`workflow-step ${
                step.num === currentMain ? 'active' : step.num < currentMain ? 'completed' : ''
              }`}
              onClick={() => onMainClick?.(step.num)}
            >
              <div className="workflow-step__num">{step.num}</div>
              <span>{step.label}</span>
            </div>
            {i < WORKFLOW.length - 1 && <div className="workflow-step__divider" />}
          </React.Fragment>
        ))}
      </div>

      {/* 하위 단계 행 — 현재 상위 단계의 subSteps만 표시 */}
      {activeStep && activeStep.subSteps.length > 0 && (
        <div className="workflow-steps__sub-row">
          {activeStep.subSteps.map((sub) => (
            <div
              key={sub.key}
              className={`workflow-sub-step ${sub.key === currentSub ? 'active' : ''}`}
              onClick={() => onSubClick?.(sub.key)}
            >
              <div className="workflow-sub-step__dot" />
              <span>{sub.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkflowSteps;

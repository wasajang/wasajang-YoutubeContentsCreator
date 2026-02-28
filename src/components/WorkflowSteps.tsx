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
    num: 3, label: 'Generate', route: '/project/storyboard',
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

const NARRATION_WORKFLOW: MainStep[] = [
  { num: 1, label: 'Script', route: '/project/idea', subSteps: [{ key: 'script', label: '대본' }, { key: 'style', label: '스타일' }] },
  { num: 2, label: 'Voice', route: '/project/timeline', subSteps: [{ key: 'tts', label: 'TTS 생성' }] },
  { num: 3, label: 'Split', route: '/project/timeline', subSteps: [{ key: 'split', label: '씬 분할' }] },
  { num: 4, label: 'Direct', route: '/project/storyboard', subSteps: [{ key: 'cast-setup', label: '캐스트' }] },
  { num: 5, label: 'Image', route: '/project/storyboard', subSteps: [{ key: 'image-gen', label: '이미지' }] },
  { num: 6, label: 'Video', route: '/project/timeline', subSteps: [{ key: 'video', label: '영상화' }] },
  { num: 7, label: 'Edit', route: '/project/timeline', subSteps: [{ key: 'edit', label: '편집' }] },
  { num: 8, label: 'Export', route: '/project/timeline', subSteps: [{ key: 'export', label: '내보내기' }] },
];

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

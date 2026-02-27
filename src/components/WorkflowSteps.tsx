import React from 'react';

interface WorkflowStepsProps {
    currentStep: number;
    onStepClick?: (step: number) => void;
}

const steps = [
    { num: 1, label: 'Idea' },
    { num: 2, label: 'Storyboard' },
    { num: 3, label: '이미지/비디오 생성' },
    { num: 4, label: '영상 편집 및 추출하기' },
];

const WorkflowSteps: React.FC<WorkflowStepsProps> = ({ currentStep, onStepClick }) => {
    return (
        <div className="workflow-steps">
            {steps.map((step, i) => (
                <React.Fragment key={step.num}>
                    <div
                        className={`workflow-step ${step.num === currentStep ? 'active' : step.num < currentStep ? 'completed' : ''
                            }`}
                        onClick={() => onStepClick?.(step.num)}
                        style={{ cursor: 'pointer' }}
                    >
                        <div className="workflow-step__num">{step.num}</div>
                        <span>{step.label}</span>
                    </div>
                    {i < steps.length - 1 && <div className="workflow-step__divider" />}
                </React.Fragment>
            ))}
        </div>
    );
};

export default WorkflowSteps;

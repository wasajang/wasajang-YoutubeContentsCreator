/**
 * 나레이션 워크플로우 헬퍼 함수
 *
 * WorkflowSteps 컴포넌트에서 분리됨.
 * narrationStep(1~8) → 그룹(1~4) / 서브스텝 key 매핑.
 *
 * react-refresh/only-export-components ESLint 경고 해소를 위해 분리.
 */

/** narrationStep(1~8) → 나레이션 그룹(1~4) 매핑 */
export function narrationStepToGroup(step: number): number {
    if (step <= 3) return 1;
    if (step <= 5) return 2;
    if (step <= 7) return 3;
    return 4;
}

/** narrationStep(1~8) → 그룹 내 서브스텝 key 매핑 */
export function narrationStepToSubKey(step: number): string {
    const map: Record<number, string> = {
        1: 'script', 2: 'voice', 3: 'split',
        4: 'cast-setup', 5: 'image-gen',
        6: 'video', 7: 'edit',
        8: 'export',
    };
    return map[step] || 'script';
}

# 012 팀 4명 병렬 검토 결과 요약 (2026-03-01)

> CTO(일론) + CPO(유나) + UXR(하나) + PM(미소) 병렬 검토

---

## A. 즉시 수정 (버그)

| # | 문제 | 파일 | 수정 |
|---|------|------|------|
| A1 | NarrationSplitStep checked=false | NarrationSplitStep.tsx:158 | **완료** |
| A2 | IdeaPage 재진입 시 mode 리셋 | IdeaPage.tsx:81 | startNewProject에 mode 추가 |
| A3 | StoryboardPage AI 모달 재등장 | StoryboardPage.tsx:35 | 덱 존재시 false |
| A4 | NarrationEditView 다음 버튼 disabled | NarrationEditView.tsx:186 | disabled 제거 |

## B. 데이터 연결 끊김

| # | 문제 | 난이도 |
|---|------|--------|
| B1 | BYOK 키 → AI 호출 미반영 | 1시간 |
| B2 | Admin 프리셋 편집 → prompt-builder 미반영 | 30분 |
| B3 | template.defaultModels 미연동 | 5분 |
| B4 | template.sampleIdea placeholder 미표시 | 5분 |
| B5 | template.instruction 프롬프트 미반영 | 10분 |
| B6 | template.sceneSplitRules 미반영 | 10분 |

## C. UX 어색함

| # | 문제 | 심각도 |
|---|------|--------|
| C1 | 홈: 대본 vs 템플릿 차이 설명 부족 | 높음 |
| C2 | 모드 선택 설명 부족 | 중 |
| C3 | 프리셋 해제 피드백 없음 | 중 |
| C4 | AI 분석 모달 갑작스러움 | 중 |
| C5 | 일괄 생성 후 진행률 없음 | 높음 |
| C6 | 타임라인 액션 불명확 | 중 |
| C7 | 크레딧 차감 사전 안내 없음 | 높음 |
| C8 | 생성 실패 시 크레딧 롤백 없음 | 중 |

## D. 구조적 이슈

| # | 문제 |
|---|------|
| D1 | 나레이션 Step 왕복 시 상태 복원 불안정 |
| D2 | mockData 폴백 → 프로덕션 부적절 |
| D3 | videoGenStatus store 미저장 |
| D4 | WorkflowSteps subClick 미구현 |

## E. CPO 비전 갭

| # | 발견 |
|---|------|
| E1 | 비전 부합도 65/100 |
| E2 | template.instruction이 프롬프트에 미반영 (가장 충격적) |
| E3 | BYOK: 크레딧 계산만 반영, 실제 API 호출에 미적용 |
| E4 | 4진입점 미실현 (현재 2개) |

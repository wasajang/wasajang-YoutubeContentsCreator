# 018 - 종합 개선 계획

> 작성일: 2026-03-03 | CTO 일론
> 근거: research.md (CPO 유나 + UXR 하나 + QA 타로 + CTO 브라우저 점검)
> 상태: CEO 검토 대기

---

## 요약

팀 리서치 결과, **구조적 완성도는 높으나 3가지 영역에서 개선이 필요합니다:**

1. **버그 수정** — 크래시/오동작 위험이 있는 코드 (즉시)
2. **UX 개선** — 사용자 혼란을 주는 UI 이슈 (빠른 시일)
3. **기능 완성** — MVP 런칭에 필수인 미구현 기능 (순차적)

---

## Phase 1: 긴급 버그 수정 (1~2파일씩, 즉시)

> 코드 오동작/크래시 위험. 기능 추가 아닌 기존 코드 안정화.

| # | 수정 내용 | 파일 | 난이도 |
|---|----------|------|--------|
| 1-1 | `tick` 함수 자기참조 버그 수정 (useRef 패턴으로) | NarrationEditView.tsx | 간단 |
| 1-2 | 타이틀 fallback '강철의 북진' → 'Untitled Project' | TimelinePage.tsx | 간단 |
| 1-3 | `alert()` 전부 Toast/CreditShortageModal로 교체 | IdeaPage, TimelinePage | 보통 |
| 1-4 | `confirm()` → 커스텀 확인 모달 | HomePage | 간단 |
| 1-5 | `getSceneGradient` 중복 제거 (유틸로 분리) | 3개 파일 | 간단 |
| 1-6 | WorkflowSteps 유틸 함수 별도 파일로 분리 | WorkflowSteps.tsx | 간단 |

---

## Phase 2: UX 개선 (사용자 혼란 해소)

> 기능은 동작하지만 사용자가 혼란스러운 부분 수정.

| # | 수정 내용 | 파일 | 난이도 |
|---|----------|------|--------|
| 2-1 | 히어로 문구 한국어로 변경 | HomePage.tsx | 간단 |
| 2-2 | "10 scenes" → "10개 씬" 등 영/한 혼재 수정 | IdeaPage.tsx | 간단 |
| 2-3 | 시네마틱 서브스텝 클릭 반응 추가 (해당 섹션 스크롤) 또는 커서 변경 | WorkflowSteps, IdeaPage | 보통 |
| 2-4 | StoryboardPage 뒤로가기 시 phase 복원 | StoryboardPage.tsx, projectStore | 보통 |
| 2-5 | AI 분석 모달 재진입 시 다시 뜨는 문제 (플래그) | StoryboardPage.tsx | 간단 |
| 2-6 | NavBar "New Project" 모드 선택 통일 | NavBar.tsx | 간단 |
| 2-7 | 하드코딩된 hex 색상 → CSS Variables | 여러 파일 | 보통 |

---

## Phase 3: 크레딧/보안 안정화 (결제 연동 전 필수)

> 크레딧 차감 오류와 API 키 노출 문제.

| # | 수정 내용 | 파일 | 난이도 |
|---|----------|------|--------|
| 3-1 | canAfford + spend 원자적 패턴 도입 | useCredits, TimelinePage | 보통 |
| 3-2 | generateAllScenes 의존성 배열 수정 + 완료 상태 관리 | useGeneration.ts | 보통 |
| 3-3 | API 키 브라우저 직접 노출 경고 표시 (프로덕션 전 백엔드 프록시 필요) | ai-llm.ts | 인지만 |

---

## Phase 4: 기능 완성 (MVP 런칭 순서)

> 기존 백로그. 팀 리서치로 우선순위 재확인됨.

| 순서 | 백로그 | 설명 | 우선순위 |
|------|--------|------|----------|
| 4-1 | 004: AI 실 연동 | Mock → Gemini 이미지 + Runway 영상 + Fish TTS | 최상 |
| 4-2 | Export 기능 | 이미지+TTS를 합친 간단한 영상 내보내기 | 상 |
| 4-3 | 005: 나레이션 Beta | Step 8 Export + 전체 여정 완성 | 중 |
| 4-4 | 006: 결제 시스템 | Stripe + 토스 실 연동 | 중 |
| 4-5 | Cast 시작 경로 | HomePage에 "Cast로 시작하기" CTA 추가 | 낮음 |

---

## 작업 우선순위 제안

```
Phase 1 (버그 수정) → Phase 2 (UX 개선) → Phase 3 (크레딧) → Phase 4 (기능)
     즉시               이번 주             결제 전             순차적
```

**CEO 판단 포인트:**

1. **Phase 1+2를 먼저 할까요, 아니면 Phase 4-1(AI 실 연동)을 먼저 할까요?**
   - 추천: Phase 1 (버그 수정) 먼저 → Phase 4-1 (AI 연동) → Phase 2 (UX 개선)
   - 이유: 버그 위에 새 기능을 쌓으면 나중에 더 힘듦

2. **Phase 1은 바로 구현해도 될까요?**
   - 대부분 1~2줄 수정 수준이라 계획 없이 바로 가능
   - CEO 승인 시 즉시 시작

3. **Phase 2-4 (뒤로가기 phase 복원)은 조금 복잡한데, 별도 계획이 필요할까요?**
   - store에 storyboardPhase 필드 추가 + navigate 시 복원
   - 별도 계획 없이 가능하지만, CEO 의견 확인

---

## 참고: 번들 크기 최적화

현재 index.js가 639KB (500KB 초과). 코드 스플리팅으로 해결 가능하나, MVP 런칭에는 영향 없으므로 후순위 배치.

```tsx
// 적용 예시 (React.lazy)
const TimelinePage = lazy(() => import('./pages/TimelinePage'));
```

---

*이 계획은 CEO 검토 후 구현 시작합니다.*

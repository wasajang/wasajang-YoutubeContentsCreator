# 018 - 종합 리서치 보고서

> 작성일: 2026-03-03 | CTO 일론 + CPO 유나 + UXR 하나 + QA 타로
> 방법: 코드 분석 + 실제 브라우저 화면 점검 + 팀 크로스 리뷰

---

## 1. 브라우저 직접 점검 결과 (CTO)

### 시네마틱 모드 전체 여정 테스트

| 페이지 | 상태 | 발견 사항 |
|--------|------|----------|
| HomePage | 정상 | CTA, 템플릿 그리드, My Cast 모두 표시. 콘솔 에러 없음 |
| IdeaPage | 정상 | 3분할 레이아웃 동작. 대본 입력 → 씬 분할(8개) 성공. 씬 개수 10 설정인데 8개 생성됨 (대본 길이 기준 자동 조절) |
| StoryboardPage (카드 선택) | 정상 | AI 분석 모달 자동 표시 → 캐릭터 3 + 배경 1 + 아이템 1 추출. 카드 덱 구성 가능 |
| StoryboardPage (컷 분할) | 정상 | 8개 씬별 서브씬 수(1/2/3) 선택, 편집/삭제 버튼 동작 |
| GeneratePage | 정상 | 8개 씬 나열, 시드 카드 표시, AI 모델 선택(Gemini/Runway) 가능 |
| TimelinePage | 정상 | 타임라인 클립 배치, TTS 트랙, 재생 컨트롤 표시 |

### 나레이션 모드 테스트

| 항목 | 상태 | 발견 사항 |
|------|------|----------|
| 템플릿 선택 | 정상 | "해외감동사연" 클릭 → 나레이션 모드 자동 진입, 프리셋 적용 |
| 워크플로우 바 | 정상 | 4그룹 압축 표시 동작 |
| 다음 버튼 | 정상 | "다음: 음성 생성" 버튼 표시 |

### 전체 콘솔 에러: 0건 (앱 에러 없음, Vite HMR 경고만)

---

## 2. CPO 유나 - 비전 대비 현황 분석

### A. 비전 vs 현실 Gap

| # | 비전 항목 | 구현 상태 | Gap |
|---|----------|----------|-----|
| 1 | 3가지 시작점 (대본/스타일/Cast) | 대본, 스타일 완성. Cast 시작 경로 미완 | Cast로 프로젝트 시작하는 CTA가 HomePage에 없음 |
| 2 | 옵션 영속성 | store에 모든 선택 저장, prompt-builder 반영 | 씬별 시드 자동 배정은 목업(수동) |
| 3 | 워크플로우 4단계 | 시네마틱 4페이지 분리 완성 | 없음 (완성) |
| 4 | Cast 스튜디오 | 카드 생성/라이브러리/즐겨찾기 완성 | Seed 기반 일관성은 실API 연동 전 검증 불가 |
| 5 | 4가지 AI 카테고리 | 5카테고리 13개 모델 등록 | 실API 연동은 대본(Gemini)만. 이미지/영상/TTS 모두 Mock |
| 6 | 크레딧 2계층 | CREDIT_COST_TABLE + BYOK 할인 구현 | 실제 결제 연동(Stripe/토스) 미구현 |
| 7 | 프리셋 확장성 | 데이터만 추가하면 되는 구조 완성 | artStyle 참조 유효성 검증 없음 |
| 8 | UGC 마켓플레이스 | Template에 authorId/price/rating 필드 존재 | DB 연동, 업로드/다운로드 미구현 (MVP 이후) |

### B. 사용자 여정 완성도

- **시네마틱:** 끊김 없이 끝까지 진행 가능 (Generate/Animate는 Mock 결과물)
- **나레이션:** Step 7까지 진행 가능. Step 8 Export만 플레이스홀더

### C. 프리셋 확장성: 양호
- 새 템플릿: `templates.ts` 배열에 객체 1개 추가하면 끝
- UI/프롬프트/AI 모델/Cast 추천 모두 자동 반영
- 런타임 오버라이드(Admin) 지원

### D. CPO 우선순위 제안

| 순위 | 항목 | 임팩트 |
|------|------|--------|
| 1 | AI 실 연동 (Mock → Real API) | 최상 - 결과물 없으면 프로덕트 가치 0 |
| 2 | Export 기능 | 상 - 최종 결과물 내보내기 불가 |
| 3 | Cast 시작 경로 완성 | 중 - 비전의 3가지 시작점 미완 |
| 4 | 결제 시스템 연동 | 중 - 런칭 시 크레딧 충전 필수 |
| 5 | 씬별 시드 자동 배정 | 중 - AI 분석이 현재 목업 |

---

## 3. UXR 하나 - 사용자 경험 분석

### A. UX 문제점 (심각도별)

#### Critical (즉시 수정)

| ID | 위치 | 문제 | 개선 |
|----|------|------|------|
| C1 | TimelinePage | 프로젝트 제목 fallback이 '강철의 북진'으로 하드코딩 | 'Untitled Project'로 통일 |
| C2 | TimelinePage | 시네마틱/나레이션 모드 렌더링 분기 구조 불안정 | guard clause 명확히 분리 |
| C3 | NavBar | "MY PROJECTS"가 홈으로 이동 (Home 링크와 중복) | 앵커 스크롤 또는 구분 |

#### Major (혼란/불편)

| ID | 위치 | 문제 | 개선 |
|----|------|------|------|
| M1 | IdeaPage | "씬 분할하기" 버튼이 2열(설정)에 있어 눈 이동 혼란 | 1열 하단으로 이동 |
| M2 | StoryboardPage | CutSplit 제목 "1단계"인데 실제로는 2번째 phase | 번호 순서 맞춤 |
| M3 | Generate→Storyboard | 뒤로가기 시 카드 선택 phase로 초기화됨 | phase 상태 store 저장 |
| M4 | HomePage | 히어로 문구 영어("What story...") 나머지 UI 한국어 | 한국어로 변경 |
| M5 | IdeaPage | 크레딧 부족 시 `alert()` 사용 | CreditShortageModal 통일 |
| M6 | TimelinePage | 여러 곳에서 `alert()` 사용 | Toast/Modal로 교체 |
| M7 | WorkflowSteps | 시네마틱 서브스텝 클릭해도 반응 없음 (cursor:pointer인데) | 스크롤 이동 또는 커서 변경 |
| M8 | HomePage | 프로젝트 열기 실패 시 사용자 알림 없음 | Toast 표시 |
| M9 | StoryboardPage | 재진입 시 AI 분석 모달 다시 뜸 | 한번 수행 후 플래그 |
| M10 | CastPage | 일반 모드에서 카드 클릭 반응 없음 | 상세 정보 표시 |

#### Minor (개선하면 좋음)

| ID | 문제 |
|----|------|
| m1 | 일부 placeholder에 영어 혼재 |
| m2 | 씬 개수 "10 scenes" → "10개 씬" |
| m3 | NavBar "New Project"가 모드 선택 건너뜀 |
| m4 | 나레이션 비활성 스텝 라벨 display:none |
| m5 | CreditShortageModal 테스트 크레딧 +50만 가능 |
| m6 | IdeaPage 내부 1-2-3 인디케이터와 워크플로우 바 중복 |
| m7 | Export 버튼 disabled 상태로 모든 페이지에 노출 |
| m8 | 프로젝트 삭제 시 `confirm()` 사용 |
| m9 | 키보드 네비게이션/접근성 미지원 |
| m10 | 하단 네비 인라인 스타일 사용 |

### B. 잘 되어 있는 UX (유지할 것)

1. WorkflowSteps 2레벨 네비게이션
2. 모드 선택 오버레이 간결함
3. 프리셋 확인 팝업 (설정 변경 미리보기)
4. IdeaPage 3분할 레이아웃
5. 빈 상태(Empty State) 안내 + 이전 단계 이동 버튼
6. CreditShortageModal (StoryboardPage에서 활용)
7. SeedCheckPhase 3단계 진행 인디케이터
8. ErrorBoundary 이중 래핑
9. SettingsModal history 연동 (뒤로가기 = 모달 닫기)
10. 다음 버튼 조건부 비활성화 + 힌트 텍스트

---

## 4. QA 타로 - 코드 품질 보고

### A. 빌드 결과
- **tsc + vite:** 성공 (에러 0)
- **번들 경고:** index.js 639KB (500KB 초과, 코드 스플리팅 필요)
- **ESLint:** 13 errors, 3 warnings

### B. 버그/리스크 목록

| 심각도 | 파일 | 문제 | 영향 |
|--------|------|------|------|
| **Critical** | NarrationEditView.tsx:55 | `tick` 함수 useCallback 내 자기참조 (React Compiler 에러) | 나레이션 편집 오디오 재생 동기화 불안정 |
| **Major** | TimelinePage.tsx:109 | `canAfford` 체크와 `spend` 사이 레이스 컨디션 | 크레딧 음수 가능 |
| **Major** | useGeneration.ts:269 | `generateAllScenes` 완료 콜백 누락 | "생성 중" 상태 영구 잔류 가능 |
| **Major** | useGeneration.ts:271 | generateAllScenes 의존성 배열에 `spend` 누락 | 크레딧 일괄 차감 오류 가능 |
| **Major** | TimelinePage.tsx:485 | 타이틀 fallback '강철의 북진' 하드코딩 | 잘못된 제목 표시 |
| **Minor** | 3개 파일 | `getSceneGradient` 함수 중복 | 유지보수성 저하 |
| **Minor** | IdeaPage + HomePage | mockCardLibrary 초기화 로직 2곳 중복 | 동작 비일관 가능 |
| **Minor** | ai-llm.ts:172 | Anthropic 브라우저 직접 호출 (API 키 노출) | 보안 리스크 |
| **Minor** | ai-llm.ts:213 | Gemini API 키가 URL 쿼리 파라미터에 포함 | 보안 리스크 |
| **Minor** | 전체 | `as any` 18곳 (Supabase 타입) | 타입 안전성 부재 |
| **Minor** | 전체 | 하드코딩된 hex 색상 15+곳 | CSS Variables 컨벤션 위반 |
| **Minor** | WorkflowSteps.tsx | 유틸 함수 export (react-refresh 경고) | HMR 불안정 가능 |

### C. 코드 품질 요약
- **잘된 점:** Provider 패턴 일관성, Store v10 마이그레이션 체계, 커스텀 훅 분리, 에러 핸들링, Tailwind 금지 준수
- **개선 필요:** tick 자기참조 버그, 크레딧 레이스 컨디션, 하드코딩 색상, 코드 중복, 번들 크기

---

## 5. 종합 평가

### 구조적 완성도: 높음
비전 문서의 핵심 설계 원칙(옵션 영속성, 프리셋 확장성, BYOK, UGC 준비, 다중 AI 모델)이 모두 코드에 반영됨.
4단계 파이프라인, 듀얼 모드, 크레딧 2계층, 프로바이더 패턴 모두 설계대로 구현.

### MVP 런칭 핵심 병목: "실제 AI 결과물"
프로바이더 패턴 덕분에 환경변수 전환으로 Mock → Real API 전환 가능한 구조가 이미 갖춰짐.

### UI/UX 품질: 양호 (개선 여지 있음)
- 전체 여정이 끊김 없이 동작 (Mock 기준)
- alert() 사용, 영/한 혼재, 뒤로가기 상태 초기화 등 UX 이슈 존재
- 접근성, 키보드 네비게이션은 MVP 이후 과제

### 코드 품질: MVP 수준 합격 (Critical 1건 수정 필요)
- NarrationEditView tick 자기참조 → 프로덕션 전 반드시 수정
- 크레딧 레이스 컨디션 → 결제 연동 전 수정 필요

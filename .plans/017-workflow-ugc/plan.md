# 017 - 워크플로우 & UGC 마켓플레이스 종합 보고서 + 구현 계획

> CTO 일론 + CPO 유나 팀 공동 작성 | 2026-03-03
> CEO 의사결정 반영 완료

---

## Context (왜 이 작업을 하는가)

AI 실 연동(004) 전에 **전체 UI/UX를 확정**하고 싶다는 CEO 요청.
현재 시네마틱/나레이션 두 워크플로우의 고객여정을 점검하고,
향후 UGC 마켓플레이스(유저 템플릿 공유/판매)를 위한 데이터 설계까지 포함.

---

## CEO 결정 사항

| 항목 | CEO 결정 |
|------|----------|
| 나레이션 워크플로우 | **4그룹 압축 표시** (8단계 → 4묶음) |
| 시네마틱 Generate | **별도 페이지 분리** (4단계 = 4페이지 일치) |
| AI 연동 전 작업 범위 | **전부** (핵심 + 나레이션 압축 + Ken Burns + Generate 분리) |

---

## Part 1: 시네마틱형 워크플로우 현황

### 고객여정 (현재)

```
홈 → [시네마틱 선택] → 아이디어 페이지 → 스토리보드 페이지 → 타임라인 페이지
         ①                  ②                    ③                 ④
```

| 단계 | 화면 | 사용자가 하는 일 | 느낌 |
|------|------|----------------|------|
| ① 대본 작성 | 아이디어 3분할 | 대본 입력 + 프리셋/스타일/비율 선택 + 씬 분할 확인 | 몰입 |
| ② 카드 선택 + 컷 분할 | 스토리보드 | AI 분석 카드 덱 구성 + 씬별 이미지 수 설정 | 탐색 |
| ③ 씨드매칭 + 이미지/영상 생성 | 스토리보드 (같은 페이지) | 프롬프트 편집 → 이미지 → 영상 생성 | 흥분 |
| ④ 편집 | 타임라인 | 클립 자르기/합치기/순서 변경 | 완성감 |

**문제:** ②③이 같은 스토리보드 페이지에 있어서, 워크플로우 바에 4단계가 있지만 실제로는 3페이지

### 잘 되어 있는 점

| # | 내용 |
|---|------|
| 1 | 아이디어 페이지 3분할 — 대본/설정/결과를 한 화면에서 끝냄 |
| 2 | 스토리보드 3단계 순차 버튼 — AI 분석 → 이미지 → 영상이 자연스러움 |
| 3 | 프롬프트 빌더가 템플릿별 스타일을 자동 반영함 |
| 4 | 씬당 1~3장 이미지 + 서브씬 시스템 잘 동작 |

### 개선 필요한 점

| # | 문제 | 심각도 | 설명 |
|---|------|--------|------|
| C1 | **4단계 표시 vs 실제 3페이지** | 중 | Generate 단계가 별도 페이지 없음 → **CEO: 분리 결정** |
| C2 | **타임라인 기능 부족** | 중 | 재생 버튼 있지만 실제 영상 재생 안 됨 |
| C3 | **컷 분할 편집/삭제 버튼 비활성** | 하 | 아이콘만 있고 클릭 반응 없음 |
| C4 | **서브이미지가 페이지 이동 시 소실** | 상 | 임시 메모리에만 있어 뒤로 가면 사라짐 |
| C5 | **목업 데이터가 빈 화면에 자동 표시** | 중 | 아무것도 안 만들었는데 예시 데이터가 보임 |

---

## Part 2: 나레이션형 워크플로우 현황

### 고객여정 (현재)

```
홈 → 아이디어 → 타임라인 → 타임라인 → 스토리보드 → 스토리보드 → 타임라인 → 타임라인 → 타임라인
 ①     ②        ③         ④          ⑤           ⑥          ⑦         ⑧
```

| 단계 | 화면 | 사용자가 하는 일 | 느낌 |
|------|------|----------------|------|
| ① 대본 | 아이디어 | 대본 입력 + 설정 선택 | 기대 |
| ② 음성 | 타임라인 | TTS 생성 → 미리듣기 | 호기심 |
| ③ 분할 | 타임라인 | 분할 기준 선택, 씬 합치기/나누기 | 조정 |
| ④ 카드 | 스토리보드 | AI 분석 or 카드 선택 | 설정 |
| ⑤ 이미지 | 스토리보드 | 이미지 일괄 생성 | 흥분 |
| ⑥ 영상화 | 타임라인 | 영상화할 씬 체크 + Ken Burns | 선택 |
| ⑦ 편집 | 타임라인 | 재생하며 편집 | 편집 |
| ⑧ 내보내기 | 타임라인 | (미구현) | - |

### 잘 되어 있는 점

| # | 내용 |
|---|------|
| 1 | 음성 먼저 → 타이밍 기반 자동 분할 설계가 적합 |
| 2 | 모든 씬을 영상으로 안 만들어도 됨 (Ken Burns 대체) |
| 3 | 씬 합치기/나누기 수동 조정 가능 |

### 개선 필요한 점

| # | 문제 | 심각도 | 설명 |
|---|------|--------|------|
| N1 | **페이지 핑퐁** | 상 | 타임라인 → 스토리보드 → 타임라인 왕복 |
| N2 | **8단계 과다** | 중 | 경쟁사 3~4단계 대비 복잡해 보임 → **CEO: 4그룹 압축 결정** |
| N3 | **내보내기 미구현** | 중 | 마지막 단계가 빈 화면 |
| N4 | **Ken Burns 효과 안 보임** | 중 | 선택은 가능하지만 화면에 효과 없음 → **CEO: 구현 결정** |
| N5 | **TTS 타이밍 추정치** | 중 | AI 실 연동 시 교체 필요 |

---

## Part 3: 양 모드 공통 문제점

| # | 문제 | 영향 |
|---|------|------|
| 1 | 생성 이미지가 페이지 이동 시 소실 (임시 메모리) | 시네마틱 + 나레이션 |
| 2 | 목업 데이터가 빈 화면에 자동 표시 | 모든 페이지 |
| 3 | 워크플로우 상단 바 일부 단계 이동 불가 | 모든 모드 |

---

## Part 4: 구현 계획 (CEO 결정 반영)

### 작업 순서 (총 7개 작업, 약 5~7일)

| 순서 | 작업명 | 설명 | 규모 | 수정 파일 |
|------|--------|------|------|----------|
| **1** | 서브이미지 영구 저장 | sceneImages를 store에 추가 (v10 마이그레이션) | 중 | `projectStore.ts`, `useGeneration.ts` |
| **2** | 컷 분할 편집/삭제 활성화 | CutSplitPhase의 Pencil/Trash2 버튼에 핸들러 연결 | 소 | `CutSplitPhase.tsx` |
| **3** | 목업 데이터 폴백 정리 | 빈 상태에서 목업 대신 안내 문구 표시 | 소 | `StoryboardPage.tsx`, `TimelinePage.tsx` |
| **4** | 나레이션 8→4그룹 압축 | 워크플로우 인디케이터를 4묶음으로 표시 | 중 | `WorkflowSteps.tsx`, `TimelinePage.tsx` |
| **5** | Generate 페이지 분리 | StoryboardPage의 SeedCheckPhase를 새 GeneratePage로 이동 | 대 | 신규: `GeneratePage.tsx`, 수정: `StoryboardPage.tsx`, `App.tsx`, `WorkflowSteps.tsx` |
| **6** | Ken Burns CSS 구현 | zoom-in/out, pan-left/right 4가지 CSS 애니메이션 | 중 | `index.css`, `NarrationPreview.tsx` |
| **7** | 워크플로우 바 네비게이션 정비 | 각 단계 클릭 시 올바른 페이지로 이동 | 소 | `WorkflowSteps.tsx` |

### 작업 1: 서브이미지 영구 저장

**현재:** `useGeneration.ts`의 `useState`로 `sceneImages: Record<string, string[]>` 관리 → 페이지 이탈 시 소실

**변경:**
- `projectStore.ts`에 `sceneImages` 필드 추가
- `useGeneration.ts`에서 store의 sceneImages를 읽고 쓰도록 변경
- store 버전 v9 → v10 마이그레이션 추가
- `partialize`에 `sceneImages` 포함하여 localStorage 영속화

**파일:**
- `src/store/projectStore.ts` — sceneImages 필드 + setter + v10 마이그레이션
- `src/hooks/useGeneration.ts` — useState → store 연동

### 작업 2: 컷 분할 편집/삭제 활성화

**현재:** `CutSplitPhase.tsx`에 Pencil/Trash2 아이콘이 있지만 onClick 핸들러 없음

**변경:**
- Pencil 클릭 → 해당 씬 텍스트 편집 모드 (textarea)
- Trash2 클릭 → 해당 씬 삭제 (최소 1개 유지 확인)
- store의 `scenes` 배열 업데이트

**파일:**
- `src/components/storyboard/CutSplitPhase.tsx`

### 작업 3: 목업 데이터 폴백 정리

**현재:** `StoryboardPage.tsx`, `TimelinePage.tsx`에서 `storeScenes.length > 0 ? storeScenes : mockData` 패턴

**변경:**
- 목업 폴백 제거
- 빈 상태일 때 "아이디어 페이지에서 대본을 먼저 작성해주세요" 안내 + 이동 버튼

**파일:**
- `src/pages/StoryboardPage.tsx`
- `src/pages/TimelinePage.tsx`

### 작업 4: 나레이션 8→4그룹 압축

**현재:** WorkflowSteps에 8개 숫자 표시

**변경 (4그룹):**

| 그룹 | 포함 단계 | 표시 라벨 |
|------|----------|----------|
| 1 | Script + Voice + Split | 대본 & 음성 |
| 2 | Direct + Image | 시각화 |
| 3 | Video + Edit | 영상 & 편집 |
| 4 | Export | 내보내기 |

- WorkflowSteps의 NARRATION_WORKFLOW 배열을 4개 그룹 구조로 변경
- 각 그룹 클릭 시 해당 첫 번째 서브스텝으로 이동
- 현재 서브스텝을 그룹 내 작은 인디케이터로 표시

**파일:**
- `src/components/WorkflowSteps.tsx`
- `src/pages/TimelinePage.tsx` (그룹 기반 narrationStep 매핑)

### 작업 5: Generate 페이지 분리 (가장 큰 작업)

**현재:** StoryboardPage 안에 CastSetupPhase → CutSplitPhase → SeedCheckPhase 3개 phase

**변경:**
- StoryboardPage: CastSetupPhase + CutSplitPhase만 남김 (덱 선택 + 컷 분할)
- 새 GeneratePage 생성: SeedCheckPhase를 여기로 이동 (씨드매칭 + 이미지/영상 생성)
- 라우팅: `/project/generate` 추가
- WorkflowSteps 시네마틱 4단계가 4페이지와 1:1 매핑

**변경 후 시네마틱 흐름:**
```
① Idea (/project/idea)           — 대본 + 설정
② Storyboard (/project/storyboard) — 카드 선택 + 컷 분할
③ Generate (/project/generate)     — 씨드매칭 + 이미지/영상 생성  ← 신규 페이지
④ Animate (/project/timeline)      — 타임라인 편집
```

**파일:**
- 신규: `src/pages/GeneratePage.tsx`
- 수정: `src/pages/StoryboardPage.tsx` (SeedCheckPhase 제거, "다음: 생성" 버튼 추가)
- 수정: `src/App.tsx` (라우트 추가)
- 수정: `src/components/WorkflowSteps.tsx` (클릭 네비게이션 업데이트)

**주의사항:**
- `useGeneration` 훅은 GeneratePage에서 그대로 사용
- `useDeck` 훅은 StoryboardPage에서 설정한 deck을 store에서 읽음
- 나레이션 모드는 이 페이지를 사용하지 않음 (기존 flow 유지)

### 작업 6: Ken Burns CSS 구현

**현재:** NarrationVideoStep에서 effect 값을 저장하지만, 실제 CSS 애니메이션 없음

**변경:**
- 4가지 효과의 CSS @keyframes 정의
  - `zoom-in`: scale(1) → scale(1.3) (8초)
  - `zoom-out`: scale(1.3) → scale(1) (8초)
  - `pan-left`: translateX(0) → translateX(-10%) (8초)
  - `pan-right`: translateX(-10%) → translateX(0) (8초)
- NarrationPreview 컴포넌트에서 effect 값에 따라 CSS 클래스 적용

**파일:**
- `src/index.css` (또는 해당 CSS 파일) — @keyframes 추가
- `src/components/narration/NarrationPreview.tsx` — effect 기반 className 적용

### 작업 7: 워크플로우 바 네비게이션 정비

**현재:** 일부 단계 클릭 시 이동 안 됨

**변경:**
- 시네마틱: 4단계 모두 클릭 → 해당 페이지로 navigate
- 나레이션: 4그룹 모두 클릭 → 해당 그룹 첫 서브스텝으로 이동
- 현재 단계보다 앞으로만 이동 가능 (뒤로는 제한 or 경고)

**파일:**
- `src/components/WorkflowSteps.tsx`

---

## Part 5: UGC 마켓플레이스 — 템플릿 데이터 설계

### 핵심 컨셉: "영상 레시피" 마켓

**템플릿 생성 경로 2가지 (둘 다 필수):**

| 경로 | 대상 | 설명 |
|------|------|------|
| **A. 레시피 저장** | 일반 유저 | 영상을 만든 후 "이 설정을 레시피로 저장" → 현재 프로젝트 설정을 자동 추출 |
| **B. 직접 설계** | 전문 크리에이터 | 템플릿 에디터에서 설정값(프롬프트 규칙, 캐스트, AI 모델 등)을 직접 입력하여 업로드 |

- 경로 A: 초보자도 쉽게 공유 가능 (프로젝트 설정을 1클릭 추출)
- 경로 B: 전문가가 정교하게 설계 가능 (프롬프트 prefix/suffix/instruction 직접 편집)
- 두 경로 모두 같은 Template 데이터 구조로 저장됨

### 현재 준비 상태

| 항목 | 상태 | 점수 |
|------|------|------|
| 템플릿 데이터 구조 | 완벽 (UGC 필드 이미 선언됨) | 10/10 |
| 프롬프트 빌더 | 우수 (템플릿별 스타일 자동 반영) | 9/10 |
| 캐스트 시스템 | 잘 구현됨 | 8/10 |
| 어드민 관리 도구 | 기본 구현 | 7/10 |
| DB 스키마 | 부분 준비 | 6/10 |
| 마켓 UI | 미구현 | 0/10 |
| 수익 분배 | 미구현 | 0/10 |

### 템플릿에 저장되는 데이터 (현재 + UGC 추가 필요)

#### 현재 이미 있는 데이터

| 카테고리 | 데이터 | 역할 |
|----------|--------|------|
| **기본 정보** | 이름, 설명, 카테고리, 태그 | 검색/표시용 |
| **모드 설정** | 시네마틱/나레이션, 종횡비, 아트스타일 | 자동 적용 |
| **대본 규칙** | AI 시스템 프롬프트, 씬 분할 기준 | AI가 대본을 어떤 톤으로 쓸지 |
| **이미지 규칙** | 프롬프트 접두사/접미사/지시문/네거티브 | AI가 어떤 스타일 이미지를 만들지 |
| **영상 규칙** | 프롬프트 접두사/접미사/기본길이/지시문 | AI가 어떤 영상을 만들지 |
| **추천 캐스트** | 배우 3~5명, 배경 2~3개, 소품 0~2개 | 자동 카드 배정 |
| **AI 모델** | 대본/이미지/영상/TTS 각각 기본 모델 | 자동 모델 선택 |
| **음성 설정** | 음성ID, 속도, 톤 | TTS 기본값 |
| **예시** | 샘플 아이디어, 샘플 대본 | 사용자 참고용 |
| **UGC 기초** | 작성자ID, 가격, 다운로드수, 평점 | 이미 선언됨 |

#### UGC를 위해 추가해야 할 데이터

| 카테고리 | 데이터 | 역할 | 우선순위 |
|----------|--------|------|----------|
| **미리보기** | 샘플 이미지 3~5장 | "이 템플릿으로 이런 결과물" 보여주기 | 필수 |
| **미리보기** | 샘플 영상 URL | 영상 미리보기 | 높음 |
| **커뮤니티** | 평가 수, 리뷰 수 | 인기도/신뢰도 판단 | 필수 |
| **커뮤니티** | 좋아요 수 | 관심도 표시 | 중간 |
| **파생** | 원본 템플릿 ID | "이 템플릿을 기반으로 만들었어요" 추적 | 중간 |
| **파생** | 파생 횟수 | 얼마나 많은 유저가 이걸 기반으로 만들었는지 | 중간 |
| **수익** | 라이선스 (무료/유료) | 가격 모델 | 필수 |
| **수익** | 수익 분배율 (기본 70:30) | 판매자 70% : 플랫폼 30% | 높음 |
| **플랫폼** | 예상 영상 길이 | 쇼츠/롱폼 구분 | 높음 |
| **플랫폼** | 대상 플랫폼 (YouTube/Shorts/TikTok) | 용도 표시 | 높음 |
| **관리** | 상태 (초안/심사중/공개/정지) | 품질 관리 | 필수 |
| **작성자** | 프로필 이미지 | 마켓에서 작성자 표시 | 중간 |

### DB 테이블 구조 (Supabase, Phase B~C)

```
1. style_presets (메인 테이블)
   - 현재 Template 타입의 모든 필드
   - + 위 추가 데이터
   - + status (draft/review/published/suspended)

2. preset_purchases (구매 이력)
   - 누가, 어떤 템플릿을, 얼마에 샀는지

3. preset_reviews (리뷰/평점)
   - 별점 1~5 + 코멘트

4. preset_revenue (수익 분배)
   - 구매자 지불 크레딧 → 작성자 몫 + 플랫폼 몫
```

### UGC 로드맵 (유나팀 추천)

| 단계 | 내용 | 시기 |
|------|------|------|
| **Phase A** (현재) | 공식 템플릿 5개로 운영 | 지금 |
| **Phase B** | 공식 템플릿을 DB로 이전 | AI 연동 후 |
| **Phase C** (MVP) | 유저가 "레시피 저장" → 무료 공유 | 유저 100명+ |
| **Phase D** | 유료 판매 + 수익 분배 | 유저 1,000명+ |

---

## Part 6: 수정 대상 핵심 파일

| 파일 | 관련 작업 |
|------|----------|
| `src/store/projectStore.ts` | 작업1: sceneImages 영구 저장 (v10) |
| `src/hooks/useGeneration.ts` | 작업1: store 연동 |
| `src/components/storyboard/CutSplitPhase.tsx` | 작업2: 편집/삭제 활성화 |
| `src/pages/StoryboardPage.tsx` | 작업3: 목업 정리 + 작업5: SeedCheck 제거 |
| `src/pages/TimelinePage.tsx` | 작업3: 목업 정리 + 작업4: 그룹 매핑 |
| `src/components/WorkflowSteps.tsx` | 작업4: 나레이션 압축 + 작업5: 시네마틱 매핑 + 작업7: 네비게이션 |
| **신규** `src/pages/GeneratePage.tsx` | 작업5: Generate 페이지 |
| `src/App.tsx` | 작업5: 라우트 추가 |
| `src/index.css` | 작업6: Ken Burns 애니메이션 |
| `src/components/narration/NarrationPreview.tsx` | 작업6: effect className |
| `src/data/templates.ts` | Part5: UGC 필드 (Phase B에서) |

---

## Part 7: 검증 방법

1. **서브이미지 저장** — 이미지 생성 후 다른 페이지 갔다가 돌아와도 이미지 유지 확인
2. **편집 버튼** — 컷 분할에서 씬 텍스트 편집, 삭제 동작 확인
3. **목업 정리** — 빈 프로젝트로 스토리보드 진입 시 안내 문구 표시
4. **나레이션 압축** — 워크플로우 바에 4그룹만 표시, 서브스텝 인디케이터 동작
5. **Generate 페이지** — 스토리보드에서 "다음" → Generate 페이지 진입, 이미지/영상 생성 정상
6. **Ken Burns** — 나레이션 미선택 씬에서 zoom-in/out, pan-left/right 애니메이션 시각 확인
7. **워크플로우 바** — 시네마틱 4단계, 나레이션 4그룹 모두 클릭 이동 정상
8. **빌드** — `npm run build` 에러 없음
9. **양 모드 전체 흐름** — 시네마틱/나레이션 처음부터 끝까지 브라우저 테스트

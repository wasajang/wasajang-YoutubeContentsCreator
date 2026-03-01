# 003-조직 구성 + 서브에이전트 시스템 구현 계획

> 버전: v2.0
> 작성일: 2026-02-28
> 상태: ✅ 구현 완료
> 근거: research.md 참조

---

## 개요

AntiGravity 프로젝트에 **2개 본부 (프로덕트 + 기술)** 체제의 조직을 구축.
Claude Code의 `.claude/agents/` + `.claude/skills/` 시스템을 활용.

---

## 조직 구성 — "AntiGravity Studio"

### 총 인원: 8명 + CEO

```
                         CEO (사용자)
                              │
                 ┌────────────┴────────────┐
                 │                         │
     🟣 프로덕트 본부 (CPO)       🔵 기술 본부 (CTO)
     "무엇을, 왜"                "어떻게"
                 │                         │
     ┌───┬───┬───┘          ┌─────┬────┬────┘
     │   │   │              │     │    │
    🟪  🩷  🟠            🔷   🩵   🔶   🟩
    PM  UXR 마케팅        FE   CSS  AI   QA
```

### 인원 카드

| # | 이름 | 색상 | 부서 | 직책 | 모델 | 성격 |
|---|------|------|------|------|------|------|
| 0 | CTO | 🔵 Blue | 경영진 | 기술 총괄 | opus/sonnet | 메인 Claude |
| 1 | 🟣 Yuna (유나) | Purple | 프로덕트 | CPO | opus | 비전 수호자 |
| 2 | 🟪 Miso (미소) | Violet | 프로덕트 | PM | sonnet | 스펙 정리왕 |
| 3 | 🩷 Hana (하나) | Pink | 프로덕트 | UX Researcher | haiku | 사용자 대변인 |
| 4 | 🟠 Sora (소라) | Orange | 프로덕트 | Marketer | haiku | 시장 분석가 |
| 5 | 🔷 Rin (린) | Dodger Blue | 엔지니어링 | FE Architect | sonnet | 컴포넌트 장인 |
| 6 | 🩵 Nuri (누리) | Cyan | 엔지니어링 | CSS Specialist | haiku | 비주얼 마법사 |
| 7 | 🔶 Kai (카이) | Amber | 엔지니어링 | AI Engineer | sonnet | API 연결 전문가 |
| 8 | 🟩 Taro (타로) | Green | 엔지니어링 | QA Engineer | haiku | 버그 사냥꾼 |

---

## 생성된 파일 목록

### 에이전트 (8개)
```
.claude/agents/
├── cpo-yuna.md      🟣 CPO — 프로덕트 비전, 로드맵, 우선순위
├── pm-miso.md       🟪 PM — PRD, 유저스토리, 백로그
├── uxr-hana.md      🩷 UXR — 사용자 플로우 분석, UX 개선안
├── mkt-sora.md      🟠 마케팅 — 경쟁사 분석, GTM 전략
├── fe-rin.md        🔷 FE — React 컴포넌트/훅 구현
├── css-nuri.md      🩵 CSS — 스타일링, 다크테마, 반응형
├── ai-kai.md        🔶 AI — AI API 연동, 프롬프트 엔지니어링
└── qa-taro.md       🟩 QA — 빌드 검증, 에러 탐지 (읽기전용)
```

### 스킬 (4개)
```
.claude/skills/
├── project-rules/        공통 코딩 규칙 + 금지사항
│   └── SKILL.md
├── testing-checklist/    검증 체크리스트
│   └── SKILL.md
├── product-strategy/     프로덕트 전략 가이드 (CPO/PM/마케팅용)
│   └── SKILL.md
└── ux-research/          UX 리서치 방법론 (UXR/PM용)
    └── SKILL.md
```

### 조직도 문서
```
.claude/ORG-CHART.md      전체 조직도 + 인원 카드 + 워크플로우
```

---

## 워크플로우 — 누가 언제 투입되나?

```
사용자 요청
    │
    ▼
[CTO] 요청 분석
    │
    ├─ 프로덕트 질문 ──→ 🟣 유나(CPO) / 🟪 미소(PM) 투입
    ├─ UX 개선 ────────→ 🩷 하나(UXR) 투입
    ├─ 시장 분석 ──────→ 🟠 소라(마케팅) 투입
    │
    ├─ 간단 개발 ──────→ CTO 직접 처리
    │   (1~2파일)
    │
    └─ 복잡 개발 ──────→ 풀 파이프라인:
        (5+파일)
        │
        ├─ 1. CTO: research.md
        ├─ 2. CTO: plan.md (팀원별 업무 배분)
        ├─ 3. 사용자 승인
        ├─ 4. 병렬 실행:
        │   ├─ 🔷 린(FE): 컴포넌트
        │   ├─ 🩵 누리(CSS): 스타일
        │   ├─ 🔶 카이(AI): AI서비스
        │   └─ 필요 시 다른 팀원
        ├─ 5. 🟩 타로(QA): 통합 검증
        └─ 6. CTO: 코드리뷰 + 머지
```

---

## 호출 예시 (사용자 참고)

```
"유나야, 다음 작업 우선순위 정리해줘"    → 🟣 CPO
"미소야, 결제 기능 PRD 써줘"            → 🟪 PM
"하나야, 홈페이지 UX 분석해줘"          → 🩷 UXR
"소라야, 경쟁사 가격 비교해줘"          → 🟠 마케팅
"린아, 크레딧 페이지 만들어줘"          → 🔷 FE
"누리야, 버튼 스타일 수정해줘"          → 🩵 CSS
"카이야, Replicate API 연결해줘"        → 🔶 AI
"타로야, 빌드 확인해줘"                → 🟩 QA
```

---

*v2.0 — 구현 완료*

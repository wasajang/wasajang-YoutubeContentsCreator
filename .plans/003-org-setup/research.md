# 003-조직 구성 + 서브에이전트 시스템 리서치

> 작성일: 2026-02-28
> 목적: AntiGravity 프로젝트에 서브에이전트(팀원) + 스킬(업무규칙) 시스템 도입 리서치

---

## 1. 현재 가용 시스템 분석

### 1.1 Claude Code 플러그인 시스템 (실제 사용 가능 ✅)

Claude Code v2.0.13+부터 **플러그인 마켓플레이스**가 공식 지원됩니다:

```bash
# 마켓플레이스 추가 (카탈로그 등록)
/plugin marketplace add owner/repo

# 플러그인 설치
/plugin install plugin-name
```

**설치 가능한 플러그인 유형:**
| 유형 | 설명 | 파일 |
|------|------|------|
| **Skills** | 재사용 가능한 프롬프트 지시사항 | `SKILL.md` |
| **Agents** | 전문화된 AI 서브에이전트 | `agents/*.md` |
| **Hooks** | 라이프사이클 이벤트 핸들러 | `scripts/*.js` |
| **MCP Servers** | 외부 도구 연결 | MCP 설정 |
| **Commands** | 슬래시 커맨드 | 커맨드 정의 |

**공식 Anthropic 플러그인 (자동 사용 가능):**
- Code Intelligence: TypeScript, Python, Rust, Go 등 LSP
- 외부 연동: GitHub, GitLab, Jira, Notion, Figma, Vercel, Supabase 등
- 개발 워크플로우: commit-commands, pr-review-toolkit 등

### 1.2 bkit (Bkamp Vibecoding Kit)

**정체:** POPUP STUDIO PTE. LTD. (싱가포르)가 만든 **서드파티 Claude Code 플러그인**
**GitHub:** `popup-studio-ai/bkit-claude-code` (308 stars, Apache 2.0)

**설치 방법:**
```bash
/plugin marketplace add popup-studio-ai/bkit-claude-code
/plugin install bkit
```

**제공 규모:**
- 27개 Skills
- 16개 전문 AI 에이전트 (CTO-Led Team 포함)
- 45개 Scripts
- 241개 유틸리티 함수

**핵심 특징:**
- **PDCA 방법론** (Plan-Do-Check-Act) 기반 개발 워크플로우
- **CTO-Led Agent Teams**: Opus가 리드, Sonnet 전문 에이전트들이 실무 (프론트, QA, 보안 등)
- **8개 통합 명령어**: `/pdca plan`, `/pdca design`, `/pdca do`, `/pdca analyze`, `/pdca iterate`, `/pdca report`, `/pdca status`, `/pdca next`
- **3단계 프로젝트 레벨**: Starter(정적), Dynamic(풀스택), Enterprise(마이크로서비스)
- 다국어 지원 (한국어 포함 8개 언어)

**요구사항:** Claude Code v2.1.33+, Node.js v18+

### 1.3 Claude Code 자체 서브에이전트 시스템 (내장 ✅)

이미 사용 가능한 내장 서브에이전트:

| 에이전트 | 모델 | 용도 |
|---------|------|------|
| **Explore** | Haiku (빠름) | 코드베이스 읽기 전용 탐색 |
| **Plan** | 상속 | 계획 모드 리서치 |
| **General-purpose** | 상속 | 복잡한 멀티스텝 작업 |
| **Bash** | 상속 | 터미널 명령 실행 |

**커스텀 에이전트 정의 가능:**
- `.claude/agents/*.md` (프로젝트 레벨)
- `~/.claude/agents/*.md` (사용자 레벨)
- 플러그인을 통해

**에이전트 MD 파일 구조:**
```markdown
---
name: frontend-architect
model: sonnet
description: React 컴포넌트 설계 및 구현 전문가
tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
---

## 역할
React 19 + TypeScript 프론트엔드 아키텍트로...

## 규칙
1. CSS Variables만 사용 (Tailwind 금지)
2. ...
```

**핵심 능력:**
- 에이전트별 독립 컨텍스트 윈도우 + 커스텀 시스템 프롬프트
- 도구 접근 제한 가능 (예: 읽기 전용)
- 에이전트별 모델 선택 (`sonnet`, `opus`, `haiku`)
- 최대 7개 에이전트 동시 병렬 실행
- 포그라운드(블로킹) / 백그라운드(동시) 실행
- Git worktree 격리 모드

**제한사항:**
- 에이전트가 다른 에이전트를 생성할 수 없음 (중첩 불가)
- 백그라운드 에이전트는 권한 자동 거부
- 백그라운드 에이전트는 질문 불가

### 1.4 Claude Code Skills (자체 스킬 시스템 ✅)

**Skills = 가장 간단한 단위** — SKILL.md 파일 하나:

```markdown
---
name: my-skill-name
description: 이 스킬의 용도와 사용 시점
---

Claude가 이 스킬을 호출할 때 따를 지시사항...
```

**배치 위치:**
- `.claude/skills/` — 프로젝트 레벨 (팀 공유)
- `~/.claude/skills/` — 사용자 레벨 (개인)
- 플러그인을 통해 설치

---

## 2. 우리 프로젝트 현황 분석

### 2.1 프로젝트 규모

| 지표 | 수치 |
|------|------|
| TypeScript 파일 | 51개 |
| 코드 라인 | ~7,100 (CSS 제외) |
| CSS 라인 | ~7,300 |
| 총 라인 | ~14,400 |
| 페이지 | 8개 |
| 서비스 | 9개 |
| 훅 | 7개 |
| 컴포넌트 | 15개+ |

### 2.2 도메인 분류 (7개 영역)

```
도메인                   파일수  코드량    복잡도     다음 작업
─────────────────────────────────────────────────────────────
1. 프론트엔드 UI/UX      18     3,500    🔴 높음    유지보수
2. AI 서비스             9      1,300    🔴 높음    실 연동 (003)
3. 상태관리/데이터        9      1,060    🟡 중간    안정화
4. 인증/보안             -      -        🟡 중간    유지
5. 스타일링              1      7,300    🟡 중간    모듈화
6. 라우팅/네비게이션      -      -        🟢 낮음    완성
7. 결제 시스템           0      0        🔴 높음    신규 (004)
```

### 2.3 향후 작업 (VISION.md 기반)

| 작업 | 복잡도 | 예상 규모 | 비고 |
|------|--------|----------|------|
| **003-AI 실 연동** | 🔴 높음 | 40~60시간 | Replicate, Runway, OpenAI, Fish Speech |
| **004-결제 시스템** | 🔴 높음 | 30~50시간 | Stripe + 토스 |
| **005-UGC 마켓** | 🔴 높음 | 60~80시간 | 프리셋 공유/판매 |
| **006-배포** | 🟡 중간 | 20~30시간 | Vercel + Supabase |

---

## 3. bkit vs 자체 구축 비교

### 3.1 비교표

| 항목 | bkit 사용 | 자체 구축 |
|------|----------|----------|
| **설치 난이도** | 쉬움 (2줄 명령) | 중간 (MD 파일 작성) |
| **커스터마이징** | 제한적 (범용 설계) | 완전 자유 |
| **우리 워크플로우 호환** | 부분적 (PDCA ≈ 우리 5단계) | 완벽 (맞춤 설계) |
| **학습 곡선** | 높음 (27 스킬, 8 명령어) | 낮음 (우리가 만들어서) |
| **프로젝트 맥락** | 범용 | AntiGravity 전용 |
| **CLAUDE.md 호환** | 충돌 가능 | 완벽 호환 |
| **유지보수** | 서드파티 의존 | 자체 관리 |
| **에이전트 수** | 16개 (과다) | 필요한 만큼 |
| **비용** | 토큰 소비 증가 (범용 프롬프트) | 최적화 가능 |

### 3.2 CTO 판단

**결론: 자체 구축을 추천합니다.** 이유:

1. **우리 워크플로우가 이미 성숙** — CLAUDE.md의 5단계 파이프라인이 bkit의 PDCA보다 우리에게 더 적합
2. **프로젝트 맥락 최적화** — 범용 에이전트 16개보다 우리 도메인에 맞는 5~6개가 효율적
3. **CLAUDE.md 충돌 방지** — bkit은 자체 규칙이 있어 기존 CTO 역할과 충돌 가능
4. **토큰 경제성** — 범용 프롬프트는 불필요한 컨텍스트로 토큰 낭비
5. **학습 곡선** — 바이브코딩 초보자인 사용자가 27개 스킬을 배우기 부담

**하이브리드 접근 가능:** bkit의 **좋은 아이디어**는 참고하되, 구현은 자체로

---

## 4. 권장 조직 구성안 (자체 구축)

### 4.1 조직도 — "AntiGravity 스튜디오"

```
                    ┌─────────────────┐
                    │   CTO (Claude)  │  ← 기존 CLAUDE.md 역할
                    │  총괄 + 의사결정  │
                    └────────┬────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
   ┌──────┴──────┐   ┌──────┴──────┐   ┌──────┴──────┐
   │ 프론트엔드팀  │   │  AI/백엔드팀  │   │   QA팀      │
   │             │   │             │   │             │
   │ 팀장: FE    │   │ 팀장: AI    │   │ 팀장: QA    │
   │ 아키텍트    │   │ 엔지니어    │   │ 엔지니어    │
   └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
          │                  │                  │
   ┌──────┴──────┐   ┌──────┴──────┐   ┌──────┴──────┐
   │ UI 개발자    │   │ API 연동    │   │ 빌드 검증   │
   │ CSS 스페셜  │   │ 프롬프트 엔지│   │ 브라우저 QA  │
   └─────────────┘   └─────────────┘   └─────────────┘
```

### 4.2 에이전트 목록 (5+1개)

| # | 에이전트 이름 | 모델 | 역할 | 도구 접근 |
|---|-------------|------|------|---------|
| 1 | **fe-architect** | sonnet | React 컴포넌트 설계/구현 | Read, Write, Edit, Glob, Grep |
| 2 | **css-specialist** | haiku | CSS 스타일링 전문 | Read, Write, Edit, Glob |
| 3 | **ai-engineer** | sonnet | AI 서비스 연동/프롬프트 엔지니어링 | Read, Write, Edit, Bash, Glob, Grep |
| 4 | **qa-engineer** | sonnet | 빌드 검증, 브라우저 테스트, 에러 탐지 | Read, Bash, Glob, Grep (읽기 위주) |
| 5 | **data-architect** | sonnet | 상태관리/DB 스키마/타입 설계 | Read, Write, Edit, Glob, Grep |
| 0 | **CTO** (메인) | opus/sonnet | 총괄, 리서치, 계획, 코드리뷰 | 전체 |

### 4.3 스킬 목록 (7개)

| # | 스킬 이름 | 용도 | 적용 대상 |
|---|----------|------|---------|
| 1 | **project-rules** | 프로젝트 코딩 컨벤션 + 금지사항 | 모든 에이전트 |
| 2 | **react-patterns** | React 19 + Zustand 패턴 가이드 | fe-architect |
| 3 | **css-system** | CSS Variables + 다크테마 규칙 | css-specialist |
| 4 | **ai-service-pattern** | AI 서비스 Provider 패턴 + BYOK | ai-engineer |
| 5 | **testing-checklist** | 검증 체크리스트 (빌드/브라우저/콘솔) | qa-engineer |
| 6 | **data-patterns** | Zustand persist + Supabase 패턴 | data-architect |
| 7 | **workflow-guard** | 5단계 워크플로우 강제 (계획 전 코딩 금지) | CTO |

### 4.4 워크플로우 통합

```
사용자 요청
    │
    ▼
[CTO] 리서치 + 분류
    │
    ├─ 간단 (1~2파일) → CTO가 직접 처리
    │
    ├─ 보통 (3~5파일) → 계획 작성 → 승인 → 단일 에이전트 배치
    │
    └─ 복잡 (5+파일) → 풀 파이프라인:
        │
        ├─ 1. CTO: research.md 작성
        ├─ 2. CTO: plan.md 작성 (에이전트별 업무 배분 포함)
        ├─ 3. 사용자 검토/승인
        ├─ 4. 에이전트들 병렬 실행:
        │   ├─ fe-architect: 컴포넌트 코드
        │   ├─ css-specialist: 스타일 (병렬)
        │   ├─ ai-engineer: 서비스 코드
        │   └─ data-architect: 상태/타입
        ├─ 5. qa-engineer: 통합 검증
        └─ 6. CTO: 코드리뷰 + 머지
```

---

## 5. 기술 구현 방안

### 5.1 디렉토리 구조

```
.claude/
├── agents/                  # 서브에이전트 정의
│   ├── fe-architect.md
│   ├── css-specialist.md
│   ├── ai-engineer.md
│   ├── qa-engineer.md
│   └── data-architect.md
├── skills/                  # 스킬 (업무 규칙)
│   ├── project-rules/
│   │   └── SKILL.md
│   ├── react-patterns/
│   │   └── SKILL.md
│   ├── css-system/
│   │   └── SKILL.md
│   ├── ai-service-pattern/
│   │   └── SKILL.md
│   ├── testing-checklist/
│   │   └── SKILL.md
│   ├── data-patterns/
│   │   └── SKILL.md
│   └── workflow-guard/
│       └── SKILL.md
└── settings.json            # 기존 설정
```

### 5.2 에이전트 호출 방식

```
# CTO가 복잡한 작업 분배 시:
Task(subagent_type="fe-architect", prompt="...")    # 프론트엔드 작업
Task(subagent_type="css-specialist", prompt="...")   # CSS 작업 (병렬)
Task(subagent_type="ai-engineer", prompt="...")      # AI 서비스 작업
Task(subagent_type="qa-engineer", prompt="...")      # 검증 작업
```

### 5.3 bkit에서 참고할 아이디어

bkit의 좋은 컨셉 중 우리에게 적용할 것:

1. **PDCA 상태 추적** → 우리의 plan.md에 Phase 상태 추적 이미 있음 (✅ 표시)
2. **에이전트 팀 조율** → CTO가 Task 도구로 에이전트 배분
3. **스킬 기반 지식 주입** → SKILL.md로 도메인 지식 전달
4. **프로젝트 레벨 맞춤** → 우리는 "Dynamic" 수준 (풀스택 SPA)

---

## 6. 리스크 분석

| 리스크 | 심각도 | 완화 방안 |
|--------|--------|---------|
| 에이전트간 충돌 (같은 파일 수정) | 🔴 높음 | CTO가 파일 배분 명확히, worktree 격리 |
| 토큰 비용 증가 | 🟡 중간 | 간단한 작업은 CTO 직접, 에이전트는 복잡한 것만 |
| 에이전트 품질 편차 | 🟡 중간 | 스킬로 규칙 통일, QA 에이전트가 검증 |
| 과도한 설정 오버헤드 | 🟡 중간 | 점진적 도입 (먼저 2~3개, 필요하면 추가) |
| CLAUDE.md와 에이전트 규칙 중복 | 🟢 낮음 | CLAUDE.md = CTO 규칙, 에이전트 MD = 팀원 규칙 |

---

## 7. 결론 및 추천

### 추천: **자체 구축 + 점진적 도입**

**Phase 1 (즉시):** 핵심 에이전트 3개 + 스킬 3개
- 에이전트: `fe-architect`, `ai-engineer`, `qa-engineer`
- 스킬: `project-rules`, `react-patterns`, `testing-checklist`

**Phase 2 (필요 시):** 추가 에이전트 2개 + 스킬 4개
- 에이전트: `css-specialist`, `data-architect`
- 스킬: `css-system`, `ai-service-pattern`, `data-patterns`, `workflow-guard`

**bkit은 나중에:** 프로젝트가 Enterprise 수준으로 성장하면 bkit 도입 재검토

---

*다음 단계: plan.md 작성 → 사용자 검토 → 승인 후 구현*

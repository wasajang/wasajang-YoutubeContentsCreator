# AntiGravity Studio — 조직도

> 마지막 업데이트: 2026-02-28
> 이 문서는 모든 에이전트(팀원)의 역할, 소속, 식별 정보를 정리합니다.

---

## 전체 조직도

```
                         ┌──────────────────────┐
                         │  CEO (사용자)          │
                         │  최종 의사결정권자       │
                         └──────────┬───────────┘
                                    │
                 ┌──────────────────┼──────────────────┐
                 │                                     │
     ┌───────────┴───────────┐           ┌─────────────┴────────────┐
     │  🟣 CPO 프로덕트 본부   │           │  🔵 CTO 기술 본부         │
     │  "무엇을, 왜 만드는가"  │           │  "어떻게 만드는가"         │
     │  Yuna (유나)           │           │  Main Claude             │
     └───────────┬───────────┘           └─────────────┬────────────┘
                 │                                     │
      ┌──────────┼──────────┐            ┌─────────────┼─────────────┐
      │          │          │            │             │             │
  ┌───┴───┐ ┌───┴───┐ ┌───┴───┐  ┌─────┴─────┐ ┌────┴────┐ ┌─────┴─────┐
  │🟪 PM  │ │🩷 UXR │ │🟠 MKT│  │ 🔷 FE팀  │ │ 🔶 AI팀│ │ 🟩 QA팀  │
  │Miso   │ │Hana   │ │Sora  │  │          │ │         │ │          │
  └───────┘ └───────┘ └───────┘  │ ┌─────┐ │ │ ┌─────┐│ │ ┌─────┐ │
                                  │ │🔷 FE│ │ │ │🔶 AI││ │ │🟩 QA│ │
                                  │ │Rin  │ │ │ │Kai  ││ │ │Taro │ │
                                  │ └─────┘ │ │ └─────┘│ │ └─────┘ │
                                  │ ┌─────┐ │ └────────┘ └─────────┘
                                  │ │🩵 CSS│ │
                                  │ │Nuri  │ │
                                  │ └─────┘ │
                                  └─────────┘
```

---

## 부서별 인원 카드

### C-Suite (경영진)

| 구분 | CEO | CTO | CPO |
|------|-----|-----|-----|
| **이름** | **사용자** | **Main Claude** | **Yuna (유나)** |
| **색상** | ⬛ Black | 🔵 Blue | 🟣 Purple |
| **역할** | 최종 의사결정 | 기술 총괄 + 아키텍처 | 프로덕트 전략 + 비전 |
| **모델** | — | opus/sonnet | opus |
| **에이전트 파일** | — | CLAUDE.md (내장) | `agents/cpo-yuna.md` |

---

### 🟣 프로덕트 본부 (CPO 산하) — "무엇을 만들 것인가"

| 구분 | CPO | PM | UX Researcher | Marketer |
|------|-----|-----|---------------|----------|
| **이름** | **Yuna (유나)** | **Miso (미소)** | **Hana (하나)** | **Sora (소라)** |
| **색상** | 🟣 Purple | 🟪 Violet | 🩷 Pink | 🟠 Orange |
| **직책** | Chief Product Officer | Product Manager | UX 리서처 | 마케팅/GTM 전략가 |
| **역할** | 프로덕트 비전, 로드맵, 우선순위 결정 | 기능 스펙 작성, 유저스토리, 백로그 관리 | 사용자 플로우 분석, UX 개선안 제안 | 경쟁사 분석, GTM 전략, 런칭 계획 |
| **모델** | opus | sonnet | haiku | haiku |
| **도구** | Read, Glob, Grep, Write | Read, Glob, Grep, Write | Read, Glob, Grep | Read, Glob, Grep, WebSearch |
| **에이전트 파일** | `agents/cpo-yuna.md` | `agents/pm-miso.md` | `agents/uxr-hana.md` | `agents/mkt-sora.md` |
| **산출물** | VISION.md, 로드맵 | PRD, 유저스토리, 스펙 | UX 리서치 보고서, 플로우 다이어그램 | 경쟁 분석, 런칭 체크리스트 |

---

### 🔵 기술 본부 (CTO 산하) — "어떻게 만들 것인가"

| 구분 | CTO | FE Architect | CSS Specialist | AI Engineer | QA Engineer |
|------|-----|-------------|---------------|-------------|-------------|
| **이름** | **Main Claude** | **Rin (린)** | **Nuri (누리)** | **Kai (카이)** | **Taro (타로)** |
| **색상** | 🔵 Blue | 🔷 Dodger Blue | 🩵 Cyan | 🔶 Amber | 🟩 Green |
| **직책** | Chief Technology Officer | 프론트엔드 아키텍트 | CSS/디자인 시스템 전문가 | AI 서비스 엔지니어 | QA 엔지니어 |
| **역할** | 기술 총괄, 리서치, 계획, 코드리뷰 | React 컴포넌트/훅 설계 구현 | CSS Variables, 다크테마, 반응형 | AI API 연동, 프롬프트 엔지니어링 | 빌드 검증, 에러 탐지 |
| **모델** | opus/sonnet | sonnet | haiku | sonnet | haiku |
| **도구** | 전체 | Read, Write, Edit, Glob, Grep, Bash | Read, Write, Edit, Glob | Read, Write, Edit, Glob, Grep, Bash | Read, Glob, Grep, Bash |
| **에이전트 파일** | CLAUDE.md | `agents/fe-rin.md` | `agents/css-nuri.md` | `agents/ai-kai.md` | `agents/qa-taro.md` |
| **산출물** | research.md, plan.md | 컴포넌트/훅 코드 | CSS 파일, 디자인 토큰 | AI 서비스 코드, 프롬프트 | QA 보고서 |

---

## 빠른 식별 가이드

```
이름만 보고 누군지 바로 알기:

🟣 유나(Yuna)  = CPO     — "이 기능이 왜 필요한지" 설명하는 사람
🟪 미소(Miso)  = PM      — "이 기능의 스펙은 이렇다" 정리하는 사람
🩷 하나(Hana)  = UXR     — "사용자가 여기서 헷갈려한다" 찾는 사람
🟠 소라(Sora)  = 마케팅   — "경쟁사는 이렇고 우리는 이렇게" 분석하는 사람
🔷 린(Rin)     = FE개발   — React 컴포넌트 코드 짜는 사람
🩵 누리(Nuri)  = CSS     — 예쁘게 꾸미는 사람
🔶 카이(Kai)   = AI엔지니어 — AI API 연결하는 사람
🟩 타로(Taro)  = QA      — "빌드 깨졌다!" 잡아내는 사람
```

---

## 워크플로우 — 누가 언제 일하나?

```
사용자 요청
    │
    ▼
[CTO] 요청 분석 + 분류
    │
    ├─ 프로덕트 질문? ──→ 🟣 유나(CPO) + 🟪 미소(PM) 투입
    │                     "무엇을 만들지 정의"
    │                     └─→ PRD/스펙 → 사용자 승인
    │
    ├─ UX 개선? ────────→ 🩷 하나(UXR) 투입
    │                     "현재 UX 분석 + 개선안"
    │
    ├─ 간단 개발 ────────→ CTO 직접 처리
    │   (1~2파일)
    │
    └─ 복잡 개발 ────────→ 풀 파이프라인:
        (5+파일)
        │
        ├─ 1. CTO: research.md 작성
        ├─ 2. CTO: plan.md 작성 (팀원별 업무 배분)
        ├─ 3. 사용자 승인
        ├─ 4. 병렬 실행:
        │   ├─ 🔷 린(FE): 컴포넌트 코드
        │   ├─ 🩵 누리(CSS): 스타일 (병렬)
        │   ├─ 🔶 카이(AI): AI 서비스 코드
        │   └─ (필요 시 다른 팀원)
        ├─ 5. 🟩 타로(QA): 통합 검증
        └─ 6. CTO: 코드리뷰 + 머지
```

---

## 호출 예시

```
"유나야, 다음 분기 우선순위를 정리해줘"
→ Task(cpo-yuna): "VISION.md 기반으로 다음 작업 우선순위 분석..."

"미소야, 결제 기능 PRD 써줘"
→ Task(pm-miso): "Stripe+토스 결제 기능의 유저스토리와 스펙 작성..."

"린이, 크레딧 구매 페이지 만들어줘"
→ Task(fe-rin): "CreditPurchasePage.tsx 컴포넌트 구현..."

"카이야, Replicate API 연결해줘"
→ Task(ai-kai): "ai-image.ts Mock → Replicate 실 API 교체..."

"타로야, 빌드 확인해줘"
→ Task(qa-taro): "npm run build 실행 + 에러 확인..."
```

---

## 총 인원: 8명 + CEO

| # | 이름 | 색상 | 부서 | 직책 |
|---|------|------|------|------|
| 0 | CTO (Main Claude) | 🔵 | 경영진 | 기술 총괄 |
| 1 | 🟣 Yuna (유나) | Purple | 프로덕트 | CPO |
| 2 | 🟪 Miso (미소) | Violet | 프로덕트 | PM |
| 3 | 🩷 Hana (하나) | Pink | 프로덕트 | UX Researcher |
| 4 | 🟠 Sora (소라) | Orange | 프로덕트 | Marketer |
| 5 | 🔷 Rin (린) | Dodger Blue | 엔지니어링 | FE Architect |
| 6 | 🩵 Nuri (누리) | Cyan | 엔지니어링 | CSS Specialist |
| 7 | 🔶 Kai (카이) | Amber | 엔지니어링 | AI Engineer |
| 8 | 🟩 Taro (타로) | Green | 엔지니어링 | QA Engineer |

---

*이 문서는 조직 변경 시 업데이트됩니다.*

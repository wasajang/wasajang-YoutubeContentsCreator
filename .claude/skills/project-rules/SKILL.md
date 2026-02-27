---
name: project-rules
description: AntiGravity 프로젝트의 공통 코딩 규칙과 금지사항. 모든 에이전트가 코드 작성 시 반드시 따라야 합니다.
---

# AntiGravity 프로젝트 공통 규칙

## 절대 금지 사항
1. Tailwind CSS 사용 금지 → 순수 CSS + CSS Variables만
2. 특정 AI 모델 하드코딩 금지 → `req.model` 파라미터로 분기
3. API 키 코드 내 하드코딩 금지 → `.env` 또는 `settingsStore`
4. 계획 승인 전 코드 작성 금지 (복잡한 작업 시)
5. `git push --force` 금지
6. `.env` 파일 커밋 금지
7. `console.log` 디버깅 코드 커밋 금지

## 필수 준수 사항
1. 파일 수정 전 반드시 현재 내용 읽기
2. CSS Variables 사용 (`--color-*`, `--radius-*`, `--spacing-*`)
3. 상태 변경은 Zustand store action을 통해
4. TypeScript strict mode 준수
5. 한 번에 1~2개 파일만 수정 (큰 작업은 나눠서)
6. 변경 후 `npm run build`로 타입 체크

## 명명 규칙
| 대상 | 규칙 | 예시 |
|------|------|------|
| 컴포넌트 | PascalCase | `MyComponent.tsx` |
| 훅/스토어/유틸 | camelCase | `useAuth.ts`, `projectStore.ts` |
| CSS 클래스 | kebab-case | `.my-class`, `.scene-card` |
| 타입/인터페이스 | PascalCase | `interface Scene`, `type EntryPoint` |
| 상수 | UPPER_SNAKE_CASE | `MAX_DECK_SIZE` |

## 디렉토리 규칙
- 페이지: `src/pages/` (라우트별 1개)
- 컴포넌트: `src/components/` (공유 UI)
- 훅: `src/hooks/` (커스텀 React 훅)
- 스토어: `src/store/` (Zustand)
- 서비스: `src/services/` (API 클라이언트)
- 데이터: `src/data/` (정적 데이터, 프리셋, 레지스트리)
- 타입: `src/types/` (공유 TypeScript 타입)

## BYOK 패턴 (AI 호출 시)
- BYOK 키 우선, 없으면 플랫폼 키
- BYOK여도 플랫폼 이용료(`platformFee`)는 항상 차감
- 2계층: `platformFee`(항상) + `apiCost`(BYOK 시 면제)

## 소통 규칙
- 한국어로 소통
- 기술 용어는 괄호 안에 쉬운 설명 추가
- 변경 전 반드시 무엇을 왜 수정하는지 설명
- 에러 발생 시 원인 + 해결 방법 함께 제시

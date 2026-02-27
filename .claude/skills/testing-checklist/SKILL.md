---
name: testing-checklist
description: 코드 변경 후 반드시 수행해야 할 검증 체크리스트. 모든 구현 에이전트와 QA 에이전트가 참조합니다.
---

# 검증 체크리스트

## 모든 코드 변경 후 수행할 것:

### Level 1: 빌드 (필수 — 매번)
- `npm run build` 성공 확인
- TypeScript 에러 0개

### Level 2: 런타임 (필수 — 매번)
- 개발 서버 정상 동작 (`npm run dev`)
- 브라우저 콘솔 에러 0개
- 수정된 페이지 정상 렌더링

### Level 3: 회귀 (권장 — 2+파일 변경 시)
- 다른 페이지들 정상 동작
- localStorage 데이터 깨지지 않음
- Zustand store 상태 정합성
- 라우팅 정상 (App.tsx 라우트 확인)

### Level 4: 엣지케이스 (복잡한 변경 시)
- 게스트 모드에서 동작
- 로그인 모드에서 동작
- 빈 데이터 상태에서 동작
- 에러 상태에서 graceful 처리
- 다크 테마에서 UI 정상

## 자주 발생하는 문제 패턴

### 빌드 실패
- 원인: import 경로 오타, 타입 불일치
- 해결: 에러 메시지의 파일:라인 확인 → 수정

### HMR 에러
- 원인: Zustand store에 새 스토어 import 추가 시
- 해결: `useStore.getState()` 패턴 사용 (컴포넌트 외부)

### localStorage 깨짐
- 원인: store 스키마 변경 시 persist 마이그레이션 누락
- 해결: `projectStore.ts`의 `migrate` 함수에 버전 업 + 마이그레이션 로직 추가

### CSS 깨짐
- 원인: CSS Variables 미사용, 하드코딩된 값
- 해결: `--color-*`, `--radius-*`, `--spacing-*` 변수 사용

## 검증 결과 보고 형식

```
## 검증 결과
- 빌드: ✅/❌
- 타입 에러: 0개/N개
- 콘솔 에러: ✅ 없음 / ❌ [에러 내용]
- 회귀: ✅ 정상 / ⚠️ [주의사항]
- 요약: [한 줄 결론]
```

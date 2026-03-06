# 047 Plan: UI 프리미엄 업그레이드 (B안)

## Context

CEO 초안: 좌측 사이드바 + 우측 워크스페이스 2분할 레이아웃
→ CPO 유나팀 분석 결과: 사이드바가 4단계 파이프라인과 안 맞음
→ **CEO 최종 결정: B안** — 기존 레이아웃 유지 + 프리미엄 카드 디자인 + CSS 품질 개선
→ **적용 대상:** GeneratePage + StoryboardPage 동시

**핵심 원칙:** "뼈대는 그대로, 피부만 업그레이드"

---

## 방향 전환 정리

| 항목 | 초안 (사이드바) | B안 (최종) |
|------|----------------|-----------|
| 레이아웃 | 2분할 (사이드바+워크스페이스) | **기존 유지** (NavBar + 페이지) |
| 테마 | 사이드바 다크 + 워크스페이스 라이트 | **다크 테마 유지** (품질 개선) |
| NavBar | 제거 (사이드바 대체) | **유지** + 미세 개선 |
| 씬 카드 | SceneCardSample (라이트, 2열) | **SceneRow 유지** (5열, 프리미엄 스타일) |
| MainLayout | 신규 컴포넌트 | **사용 안 함** (/sample 테스트용만 유지) |

---

## 변경 항목 (3가지)

### A. CSS 변수 리파인먼트 + 누락 변수 수정

**파일:** `src/index.css` (`:root` 블록)

1. **누락 변수 추가:**
   - `--color-accent: #a855f7;` (NavBar 크레딧에서 참조하지만 미정의)
   - `--bg-tertiary: #141420;` (게스트 배지 등에서 참조하지만 미정의)

2. **카드 그림자 개선:**
   - `--shadow-sm`: 더 부드러운 그림자 (현재 opacity 0.3 → 0.2)
   - `--shadow-md`: 더 넓게 (현재 16px → 20px spread)
   - 카드 내부 그림자(inset) 추가: `--shadow-card-inner: inset 0 1px 0 rgba(255,255,255,0.03);`

3. **호버/전환 개선:**
   - `--transition-lift: translateY(-2px)` 변수화
   - `--hover-glow: 0 0 0 1px rgba(233, 30, 140, 0.2), 0 8px 24px rgba(0, 0, 0, 0.3)`

### B. SceneRow 프리미엄 업그레이드 (GeneratePage + StoryboardPage)

**파일:** `src/index.css` (`.sc-row` 관련 CSS)

현재 SceneRow: 5열 Flexbox (이미지 300px + 씨드 140px + 대본 flex + 프롬프트 flex + 영상 380px)
→ **레이아웃 유지**, 시각 품질만 개선

1. **카드 배경 & 경계:**
   ```css
   /* Before */
   background: var(--bg-card);      /* #1a1a2e 평면 */
   border: 1px solid var(--border-color);

   /* After */
   background: linear-gradient(180deg, #1e1e34 0%, #1a1a2e 100%);
   border: 1px solid rgba(255, 255, 255, 0.06);
   box-shadow: var(--shadow-md), var(--shadow-card-inner);
   ```

2. **호버 효과 (SceneCardSample 스타일):**
   ```css
   .sc-row:hover {
     transform: translateY(-2px);
     box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(233, 30, 140, 0.3);
   }
   ```

3. **이미지 컬럼 개선 (300px):**
   - 완성 이미지 위에 씬 번호 뱃지 (SceneCardSample의 `.scene-card-badge` 스타일 차용)
   - 다운로드 버튼 오버레이 (호버 시만 표시)
   - 완성 상태 체크 뱃지 개선 (현재 작은 체크 → 컬러풀 뱃지)

4. **대본 컬럼 개선:**
   - 대본 영역 배경: `rgba(255,255,255,0.02)` (미세한 구분)
   - 대본 텍스트 크기: 현재 0.8125rem → 0.875rem (가독성)
   - "SCRIPT" 라벨 → SceneCardSample 스타일 (아이콘 + 대문자 + letter-spacing)

5. **완성 상태 개선:**
   ```css
   .sc-row--done {
     border-color: rgba(16, 185, 129, 0.3);
     box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.15), 0 4px 16px rgba(0, 0, 0, 0.3);
   }
   ```

6. **Border radius:** `--radius-md` (10px) → `--radius-lg` (16px) for `.sc-row`

### C. NavBar 미세 개선

**파일:** `src/index.css` (`.navbar` 관련 CSS) + `src/components/NavBar.tsx`

1. **하단 경계선 개선:**
   ```css
   /* Before */
   border-bottom: 1px solid var(--border-subtle);

   /* After — 미세한 그래디언트 라인 */
   border-bottom: none;
   box-shadow: 0 1px 0 var(--border-subtle);
   ```

2. **크레딧 표시 개선:**
   - `--color-accent` 변수 정의 후 참조
   - 호버 시 약간의 발광 효과

3. **활성 네비 아이템:**
   - 현재: 배경 `rgba(255,255,255,0.05)` 만
   - 개선: 하단에 accent 색상 인디케이터 바 (2px)

---

## 수정 파일 (2개)

| 파일 | 변경 내용 |
|------|----------|
| `src/index.css` | CSS 변수 추가/수정 + `.sc-row` 프리미엄 스타일 + `.navbar` 미세 개선 |
| `src/components/NavBar.tsx` | 활성 네비 아이템 하단 바 (JSX 변경 최소) |

> **JSX 구조 변경 없음** — CSS만으로 비주얼 업그레이드

---

## 구현 순서

```
1. index.css — 누락 변수 수정 + 그림자/전환 개선 (5분)
2. index.css — .sc-row 프리미엄 스타일 적용 (20분)
3. index.css — .navbar 미세 개선 (5분)
4. NavBar.tsx — 활성 아이템 하단 바 (5분, 선택사항)
5. npm run build — 빌드 검증
6. 브라우저 테스트 — GeneratePage + StoryboardPage 확인
```

## 검증

1. GeneratePage에서 씬 카드가 프리미엄 스타일로 보이는지
2. 호버 시 카드가 살짝 올라가고 그림자가 커지는지
3. 완성 상태 카드가 초록색 글로우를 가지는지
4. NavBar 크레딧 표시가 정상인지
5. 빌드 에러 없음, 콘솔 에러 없음

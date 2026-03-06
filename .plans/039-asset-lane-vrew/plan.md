# 039: 에셋 레인 Vrew 스타일 개선

## 문제점 분석 (CEO 스크린샷 비교)

### Vrew (참조)
- 에셋 썸네일이 **넓은 별도 칼럼** (~60-80px)에 위치
- **두꺼운 파란색 세로 바**가 클립 시작~끝을 **정확히** 커버
- "..." 버튼 → 풍부한 컨텍스트 메뉴
- 에셋과 클립 영역이 **명확히 시각적으로 분리**

### 우리 서비스 (현재)
- 44px 좁은 칼럼에 에셋 겹침
- 세로선이 3px로 얇고, **각 행별로 독립 렌더링** → 클립 경계를 정확히 커버하지 못함
- 아이콘과 범위선이 시각적으로 겹침
- 축소된 씬에서 선 연결이 끊김

---

## 핵심 원인

현재 세로 범위선은 **각 클립 행(card-row) 안에 독립적으로 렌더링**됨:
```
Row 1: [asset-line top:50% ~ bottom:0]  ← 시작 행
Row 2: [asset-line top:0 ~ bottom:0]    ← 중간 행
Row 3: [asset-line top:0 ~ bottom:50%]  ← 끝 행
```

각 행이 독립적이라 높이가 다르면 선이 정확히 안 맞고, 씬 헤더 행에서 끊김.

---

## 해결 방안: 절대 위치 오버레이 방식

### 핵심 아이디어
에셋 범위선을 **개별 행 안**이 아니라 **스크롤 컨테이너 레벨**에서 렌더링.

```
┌─ scroll container (position: relative) ──────────────┐
│                                                       │
│  ┌─ asset-overlay (position: absolute) ─┐  ┌─ clips ┐│
│  │  [range bar 1: top=20px h=180px]     │  │ card 1 ││
│  │  [range bar 2: top=220px h=120px]    │  │ card 2 ││
│  │                                       │  │ card 3 ││
│  └───────────────────────────────────────┘  └────────┘│
└───────────────────────────────────────────────────────┘
```

### 구현 계획

**1단계: 에셋 오버레이 레이어**

`VrewClipList` 내부에 `asset-overlay` 컨테이너 추가:
- `position: absolute; top: 0; left: 0; width: 56px;`
- 각 MediaRange에 대해 하나의 연속 div 렌더링
- 시작/끝 클립 ref에서 Y좌표를 계산 → `top`, `height` 동적 설정

```tsx
// 각 MediaRange → 하나의 연속 바
{mediaRanges?.map(range => {
  const startEl = cardRefs.current[range.startClipIndex];
  const endEl = cardRefs.current[range.endClipIndex];
  if (!startEl || !endEl) return null;

  const containerTop = scrollRef.current?.getBoundingClientRect().top ?? 0;
  const top = startEl.getBoundingClientRect().top - containerTop + scrollRef.current.scrollTop;
  const bottom = endEl.getBoundingClientRect().bottom - containerTop + scrollRef.current.scrollTop;

  return (
    <div className="asset-range-bar" style={{ top, height: bottom - top }}>
      <div className="asset-range-bar__line" />
      <div className="asset-range-bar__thumb">
        <img src={range.url} />
      </div>
      <div className="asset-range-bar__handle--top" />
      <div className="asset-range-bar__handle--bottom" />
    </div>
  );
})}
```

**2단계: 기존 per-row 에셋 컬럼 제거**

- `hasMediaRanges` 조건부 렌더링 블록 제거
- 각 card-row에서 `asset-col` 제거
- 대신 스크롤 컨테이너 왼쪽에 `padding-left: 56px` 추가

**3단계: 위치 재계산 (ResizeObserver)**

클립 행 높이가 변하면(텍스트 길이, 축소 등) 범위 바 위치도 업데이트 필요:
- `ResizeObserver`로 `cardRefs` 변화 감지
- 스크롤 이벤트에서도 재계산 (또는 scroll 시 transform 보정)

**4단계: 시각적 개선**

| 항목 | 현재 | 변경 |
|------|------|------|
| 칼럼 너비 | 44px | 56px |
| 세로선 너비 | 3px | 4px (기본), 5px (호버) |
| 썸네일 크기 | 32x32px | 40x40px |
| 메뉴 버튼 | 썸네일 클릭 | "..." 오버레이 버튼 |
| 범위 표시 | 행별 독립 | 연속 오버레이 |
| 시작/끝 표시 | 50% 크롭 | 라운드 캡 (상단/하단 라운딩) |

---

## 수정 파일

| # | 파일 | 변경 내용 |
|---|------|----------|
| 1 | `VrewClipList.tsx` | asset-overlay 레이어 추가, per-row asset-col 제거, ResizeObserver |
| 2 | `index.css` | .asset-range-bar 스타일, 칼럼 제거 후 padding 조정 |

---

## 리스크

1. **성능:** ResizeObserver + 스크롤 이벤트 → requestAnimationFrame으로 throttle
2. **축소 씬:** 중간 클립이 숨겨져도 시작/끝 ref가 있으면 연속 바 유지
3. **기존 드래그 핸들:** 새 오버레이에서 동일한 mousedown 로직 재연결 필요

---

## 검증 방법

1. `npm run build` — 타입 에러 없는지
2. 브라우저에서:
   - 에셋 범위 바가 클립 시작~끝을 정확히 커버하는지
   - 호버 시 강조 + 클릭 시 메뉴 동작
   - 드래그 핸들로 범위 확장/축소
   - 씬 축소/확장 시 바 위치 재계산

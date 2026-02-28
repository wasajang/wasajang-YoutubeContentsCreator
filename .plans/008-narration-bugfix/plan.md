# 008 나레이션 모드 버그 + 크레딧 UX 종합 수정

> 상태: ✅ 구현 완료

---

## 해결한 문제들

### 1. 프리셋 팝업에 제작 방식 미표시 ✅
- **원인:** PresetInfoModal에 mode(나레이션/시네마틱) 표시 없음
- **수정:** "제작 방식" 항목 추가, "기본 스타일" → "아트 스타일"로 명칭 변경
- **파일:** `PresetInfoModal.tsx`

### 2. 이미지 생성 후 영상화 단계 진입 불가 ✅
- **원인:** 페이지 재진입 시 phase='cast-setup', sceneGenStatus=all 'idle'로 리셋
- **수정:** phase 초기값을 narrationStep 기반 복원, sceneGenStatus를 imageUrl 기반 복원
- **파일:** `StoryboardPage.tsx`, `useGeneration.ts`

### 3. 크레딧 부족 시 세팅으로 이동하면 상태 소실 ✅
- **원인:** StoryboardPage에 onCreditShortage 미연결 → alert()만 뜸 → 사용자가 세팅으로 이동 → 상태 소실
- **수정:** CreditShortageModal을 StoryboardPage에 연결. 페이지를 떠나지 않고 모달에서 테스트 크레딧 지급
- **파일:** `StoryboardPage.tsx`

### 4. presetId/aspectRatio 미전달 ✅
- **원인:** StoryboardPage의 useGeneration에 presetId, aspectRatio가 전달되지 않음
- **수정:** store에서 selectedPreset, aspectRatio를 가져와 genApi에 전달
- **파일:** `StoryboardPage.tsx`

### 5. IdeaPage 프리셋 모달 의존성 ✅
- **수정:** useEffect `[]` → `[selectedPreset]`
- **파일:** `IdeaPage.tsx`

---

## 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/pages/StoryboardPage.tsx` | CreditShortageModal 연결, presetId/aspectRatio 전달, phase 복원 |
| `src/hooks/useGeneration.ts` | sceneGenStatus 초기화 시 imageUrl 기반 done 복원 |
| `src/components/PresetInfoModal.tsx` | 제작 방식(모드) 표시 추가 |
| `src/pages/IdeaPage.tsx` | useEffect 의존성 수정 |

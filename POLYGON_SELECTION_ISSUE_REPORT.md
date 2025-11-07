# 다각형 선택 후 도구 상태 문제 보고서

## 문제 요약
다각형을 선택하고 변형(이동/회전/크기 변경) 후, 자동으로 특정 도구 상태로 전환되어 사용자가 통제할 수 없는 상태가 지속됨.

## 재현 단계
1. 선택 도구 활성화
2. 다각형 클릭하여 선택
3. 다각형 이동 또는 회전/크기 변경
4. **핵심**: 선택된 다각형이 있는 상태에서 "개체 밖 영역"을 클릭 시도
5. **문제 발생**: 빈 영역 클릭이 제대로 인식되지 않음
6. 도구 상태가 통제 불가능한 상태가 됨
7. 아무 개체도 선택하지 않은 상태를 만들어야 정상 상태로 복귀

## 코드 분석

### 1. 도구 상태 관리 구조
- `drawingTool`: 그리기 도구 상태 (pen, highlighter, select, eraser, none)
- `geometryTool`: 도형 도구 상태 (polygon, none, 등)
- `creationState`: 도형 생성 상태 (active, toolType, step, tempPoints)

### 2. 조사한 파일들

#### `src/features/graph2d/KonvaDrawingLayer.tsx`
**다각형 변형 이벤트 핸들러:**
- `onDragMove` (Line 1203-1233): 드래그 중 꼭짓점 업데이트
- `onDragEnd` (Line 1234-1268): 드래그 완료 시 최종 업데이트
- `onTransform` (Line 1270-1302): 변형 중 꼭짓점 실시간 업데이트
- `onTransformEnd` (Line 1303-1347): 변형 완료 시 최종 업데이트

**발견된 사항:**
- 이벤트 핸들러 내에서 `setDrawingTool`이나 `setGeometryTool`을 직접 호출하지 않음
- `updateGeometryObject`만 호출하여 좌표 업데이트

#### `src/features/geometry/GeometryToolPanel.tsx`
**도형 목록 클릭 핸들러 (Line 36-61):**
```typescript
const handleGeometryItemClick = (objId: string, e: React.MouseEvent) => {
  // ... 선택 로직 ...

  // Activate select tool if not already active
  if (setDrawingTool) {
    setDrawingTool('select')  // ← 자동으로 select 도구 활성화
  }
}
```

**발견된 사항:**
- 도형 목록에서 아이템을 클릭하면 자동으로 select 도구가 활성화됨
- 이는 의도된 동작일 수 있으나, 변형 후 이것이 트리거될 가능성

#### `src/store/index.ts`
**상태 변경 함수들:**
- `finishCreation` (Line 757-765): creationState만 초기화, 도구 상태 변경 없음
- `cancelCreation` (Line 767-775): creationState만 초기화, 도구 상태 변경 없음

## ✅ 확인된 근본 원인 (재분석)

### 클릭(Click)과 드래그(Drag)를 구분하지 못하는 문제

**위치**: `src/features/graph2d/KonvaDrawingLayer.tsx:320-339`

**핵심 문제**:

```typescript
// handleMouseDown에서 (Line 323-338)
if (clickedShape === stage) {
  // 빈 영역을 클릭하면 즉시 lasso selection 시작
  setIsLassoSelecting(true)  // ← 문제!
  setSelectionPath([{ x: pos.x, y: pos.y }])
}
```

**문제 상황**:

1. **다각형 선택 후 빈 영역 mouseDown**
   - 즉시 lasso selection 시작
   - selectionPath에 시작점 추가

2. **마우스를 조금만 움직여도** (Line 371-388)
   - handleMouseMove가 호출됨
   - selectionPath에 점이 계속 추가됨
   - 사용자는 "클릭"하려 했지만 "드래그"로 인식됨

3. **mouseUp 시** (Line 540-541)
   - lasso selection 완료
   - `setIsLassoSelecting(false)`
   - 이미 영역 선택이 완료됨

4. **결과**:
   - 사용자가 "클릭"하려 해도 항상 lasso selection이 발동
   - 다른 개체를 클릭으로 선택할 수 없음
   - 오직 영역을 그려서 선택하는 것만 가능

### 다른 앱들의 동작 방식

**정상적인 동작**:
1. mouseDown: 시작점만 기록, lasso selection은 시작하지 않음
2. mouseMove: 일정 거리(threshold) 이상 이동하면 lasso selection 시작
3. mouseUp:
   - 거의 이동하지 않았으면 → **클릭** (선택 해제)
   - 많이 이동했으면 → **드래그** (lasso selection 완료)

**현재 우리 앱**:
1. mouseDown: 즉시 lasso selection 시작 ← **문제**
2. mouseMove: 조금만 움직여도 경로 추가
3. mouseUp: 항상 lasso selection으로 처리

### 시각적 설명

```
사용자가 보는 것:
┌─────────────────────┐
│                     │
│   ▲─────▲          │  ← 빈 영역 (클릭 가능해야 함)
│   │  ▱  │          │
│   ▼─────▼          │
│                     │
└─────────────────────┘

실제 클릭 가능 영역:
┌─────────────────────┐
│ ┏━━━━━━━━━━━━━┓    │
│ ┃ ▲─────▲     ┃    │  ← Transformer 바운딩 박스
│ ┃ │  ▱  │     ┃    │     (보이지 않지만 클릭 감지)
│ ┃ ▼─────▼     ┃    │
│ ┗━━━━━━━━━━━━━┛    │
└─────────────────────┘
```

## 추가 조사 필요 사항

1. **이벤트 로깅 추가**
   - 각 이벤트 핸들러에 console.log 추가
   - 어떤 순서로 이벤트가 발생하는지 추적

2. **"마끼툴" 정확한 상태 파악**
   - 어떤 도구로 전환되는지 확인
   - geometryTool 값 확인
   - drawingTool 값 확인

3. **이벤트 전파 차단 확인**
   - e.stopPropagation() 필요 여부
   - e.preventDefault() 필요 여부

4. **GeometryToolPanel 렌더링 조건 확인**
   - 패널이 언제 활성화되는지
   - 도구 버튼이 자동으로 눌리는지

## ✅ 권장 해결 방법

### 방법 1: Transformer에서 빈 영역 클릭 시 선택 해제 (추천)

**장점**: 직관적이고 자연스러운 UX
**단점**: 없음

```typescript
// KonvaDrawingLayer.tsx의 Transformer에 추가
<Transformer
  ref={transformerRef}
  // ... 기존 속성들 ...
  onClick={(e) => {
    // Transformer의 바운딩 박스 또는 백그라운드 클릭 시
    if (e.target === transformerRef.current) {
      // 선택 해제
      setSelectedIds([])
    }
  }}
  // ... 나머지 속성들 ...
/>
```

### 방법 2: Stage 클릭 감지 개선

**장점**: 더 정확한 빈 영역 감지
**단점**: 구현이 복잡

```typescript
// handleMouseDown에서 (Line 320)
if (drawingTool === 'select') {
  const clickedShape = e.target

  // Stage 클릭 OR Transformer 클릭 OR Layer 클릭을 빈 영역으로 간주
  const isEmptyArea =
    clickedShape === stage ||
    clickedShape.getClassName() === 'Transformer' ||
    clickedShape.getClassName() === 'Layer'

  if (isEmptyArea) {
    // 빈 영역 클릭으로 처리
    if (!e.evt.shiftKey) {
      setSelectedIds([])
    }
    setIsLassoSelecting(true)
    setSelectionPath([{ x: pos.x, y: pos.y }])
  }
}
```

### 방법 3: Transformer listening 영역 제한

**장점**: Transformer의 클릭 방해 최소화
**단점**: 핸들 클릭만 감지, 바운딩 박스는 클릭 불가

```typescript
<Transformer
  ref={transformerRef}
  // ... 기존 속성들 ...
  listening={false}  // 바운딩 박스는 클릭 불가
  // 핸들은 여전히 작동함 (별도 listening 설정)
/>
```

### 방법 4: ESC 키로 선택 해제 (보조 방법)

**장점**: 사용자에게 명확한 탈출 경로 제공
**단점**: 근본 해결은 아님

```typescript
// GraphCanvas.tsx의 keydown 핸들러에 추가
if (e.key === 'Escape') {
  setSelectedIds([])  // 선택 해제
}
```

## 결론 및 권장 사항

### ✅ 문제 원인 확인 완료
- Transformer의 보이지 않는 바운딩 박스가 빈 영역 클릭을 가로챔
- 이로 인해 선택 해제 및 lasso selection이 작동하지 않음
- 사용자는 "통제 불가" 상태를 경험

### 🎯 추천 해결 방법
**방법 2 (Stage 클릭 감지 개선)**를 추천합니다:
- 근본 원인 해결
- 자연스러운 UX
- 다른 기능에 영향 없음

추가로 **방법 4 (ESC 키 선택 해제)**를 함께 구현하면:
- 사용자에게 명확한 탈출 경로 제공
- 더 나은 사용 경험

### 📝 구현 순서
1. 방법 2 구현: handleMouseDown의 빈 영역 감지 로직 개선
2. 방법 4 구현: ESC 키 핸들러 추가
3. 테스트: 다각형 선택 → 빈 영역 클릭 → 선택 해제 확인
4. 테스트: 다각형 선택 → ESC 키 → 선택 해제 확인

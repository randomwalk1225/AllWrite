# GitHub Release 생성 가이드

## 방법 1: GitHub 웹에서 직접 생성 (추천)

### Step 1: Releases 페이지 이동
1. https://github.com/randomwalk1225/AllWrite 접속
2. 오른쪽 사이드바에서 **"Releases"** 클릭
3. **"Draft a new release"** 버튼 클릭

### Step 2: 태그 생성
- **Choose a tag**: `v2.0.0` 입력 후 "Create new tag: v2.0.0 on publish" 선택
- **Target**: `master` (기본값)

### Step 3: 릴리스 정보 입력

**Release title:**
```
AllWrite 2.0.0 - Interactive Math Geometry Tool
```

**Description (아래 내용 복사):**
```markdown
## AllWrite 2.0 출시

수학 교육을 위한 대화형 기하학 및 그래프 도구입니다.

### 주요 기능

- **기하학 도구**: 점, 선분, 직선, 원, 다각형 (정다각형, 특수 다각형, 자유 다각형)
- **실시간 동기화**: 점을 드래그하면 연결된 모든 도형이 실시간으로 변형
- **특수 도형**: 직사각형, 정사각형, 평행사변형, 마름모, 연, 직각삼각형
- **중점/내분점**: 두 점의 중점, 내분점 자동 계산
- **구속점**: 선, 원, 다각형 위에 구속된 점
- **무한 캔버스**: 팬/줌 지원
- **자유 드로잉**: Krita 스타일 브러시 엔진
- **내보내기**: PDF, 이미지 저장

### 다운로드

| 플랫폼 | 파일 |
|--------|------|
| Windows | `AllWrite2-Setup-2.0.0.exe` |
| macOS | 준비 중 |

### 시스템 요구사항

- Windows 10/11
- 4GB RAM
- 200MB 디스크 공간

### 설치 방법

1. 아래에서 `.exe` 파일 다운로드
2. 다운로드한 파일 실행
3. 설치 마법사 따라 설치 완료
4. 바탕화면 또는 시작 메뉴에서 실행

---

**개발자**: Binary (randomwalk1225@gmail.com)
**라이선스**: MIT
```

### Step 4: 파일 업로드
1. **"Attach binaries by dropping them here or selecting them"** 영역에 파일 드래그
2. 업로드할 파일:
   - `release/AllWrite2 Setup 2.0.0.exe`

### Step 5: 게시
- **"Set as the latest release"** 체크
- **"Publish release"** 클릭

---

## 방법 2: GitHub CLI 사용

### GitHub CLI 설치 (수동)
1. https://cli.github.com/ 접속
2. Windows 설치 파일 다운로드
3. 설치 후 터미널 재시작

### 인증
```bash
gh auth login
```
- GitHub.com 선택
- HTTPS 선택
- 브라우저로 인증

### 릴리스 생성
```bash
cd C:\Users\rando\repos\AllWrite2

gh release create v2.0.0 \
  --title "AllWrite 2.0.0 - Interactive Math Geometry Tool" \
  --notes-file marketing/RELEASE_NOTES.md \
  "release/AllWrite2 Setup 2.0.0.exe"
```

---

## 릴리스 후 확인

생성된 릴리스 URL:
```
https://github.com/randomwalk1225/AllWrite/releases/tag/v2.0.0
```

다운로드 직접 링크 (README에 사용):
```
https://github.com/randomwalk1225/AllWrite/releases/download/v2.0.0/AllWrite2.Setup.2.0.0.exe
```

---

## 버전 업데이트 시

1. `package.json`의 version 수정
2. `npm run build`로 새 빌드
3. 새 태그로 릴리스 생성 (예: v2.0.1, v2.1.0)

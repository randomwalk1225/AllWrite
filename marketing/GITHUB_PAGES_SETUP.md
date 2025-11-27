# GitHub Pages 설정 가이드

## 현재 준비된 파일 구조

```
docs/
├── index.html          # 영어 (기본)
├── ko/
│   └── index.html      # 한글
└── screenshots/        # 스크린샷 폴더 (이미지 추가 필요)
```

### URL 구조
- `allwrite.app` (또는 `randomwalk1225.github.io/AllWrite`) → 영어
- `allwrite.app/ko` → 한글

---

## Step 1: GitHub Pages 활성화

1. GitHub 저장소로 이동: https://github.com/randomwalk1225/AllWrite
2. **Settings** 탭 클릭
3. 왼쪽 메뉴에서 **Pages** 클릭
4. **Source** 설정:
   - Branch: `master`
   - Folder: `/docs`
5. **Save** 클릭

활성화 후 기본 URL:
```
https://randomwalk1225.github.io/AllWrite
```

---

## Step 2: 변경사항 커밋 & 푸시

```bash
cd C:\Users\rando\repos\AllWrite2

# docs 폴더 추가
git add docs/
git commit -m "Add landing pages (English + Korean) for GitHub Pages"
git push origin master
```

---

## Step 3: 스크린샷 추가

### 필요한 파일 목록

`docs/screenshots/` 폴더에 추가:

| 파일명 | 용도 | 권장 크기 |
|--------|------|----------|
| `main.png` | 메인 히어로 이미지 | 1920x1080 |
| `polygon-demo.gif` | 정다각형 데모 | 800x500 |
| `circle-demo.gif` | 원 작도 데모 | 800x500 |
| `midpoint-demo.gif` | 중점/내분점 데모 | 800x500 |
| `pen-demo.gif` | 펜 드로잉 데모 | 800x500 |
| `og-image.png` | 소셜 공유용 | 1200x630 |

### 스크린샷 추가 후

`docs/index.html`과 `docs/ko/index.html`에서:

```html
<!-- 플레이스홀더를 실제 이미지로 교체 -->
<div class="screenshot-placeholder">...</div>

<!-- 아래로 변경 -->
<img src="screenshots/main.png" alt="AllWrite 2.0" class="hero-image">
```

---

## Step 4: 커스텀 도메인 연결 (선택사항)

### 4-1. 도메인 구매
- 추천: Cloudflare 또는 Namecheap
- 예: `allwrite.app` (~$14/년)

### 4-2. CNAME 파일 생성

`docs/CNAME` 파일 생성:
```
allwrite.app
```

### 4-3. DNS 설정

도메인 등록 업체에서 설정:

**A 레코드 (4개):**
```
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153
```

**CNAME 레코드:**
```
www → randomwalk1225.github.io
```

### 4-4. GitHub에서 설정

1. Settings → Pages
2. Custom domain에 도메인 입력
3. DNS 전파 후 "Enforce HTTPS" 활성화

---

## 최종 URL

### 도메인 없이
```
https://randomwalk1225.github.io/AllWrite      # 영어
https://randomwalk1225.github.io/AllWrite/ko   # 한글
```

### 커스텀 도메인 (설정 후)
```
https://allwrite.app      # 영어
https://allwrite.app/ko   # 한글
```

---

## 체크리스트

### 즉시 실행
- [ ] `git add docs/ && git commit && git push`
- [ ] GitHub Settings → Pages 활성화
- [ ] 페이지 접속 확인

### 스크린샷 추가 후
- [ ] screenshots 폴더에 이미지 추가
- [ ] HTML에서 플레이스홀더를 실제 이미지로 교체
- [ ] 다시 커밋 & 푸시

### 도메인 구매 후
- [ ] CNAME 파일 생성
- [ ] DNS 설정
- [ ] HTTPS 활성화 확인

---

## 문제 해결

### 404 에러
1. Settings → Pages에서 Source가 `/docs`인지 확인
2. `docs/index.html` 존재 여부 확인
3. push 완료 여부 확인

### 이미지가 안 보임
- 경로 확인: `screenshots/main.png` (상대 경로)
- 한글 페이지에서는 `../screenshots/main.png`

### HTTPS 안 됨
- DNS 전파 대기 (최대 48시간)
- dnschecker.org에서 확인

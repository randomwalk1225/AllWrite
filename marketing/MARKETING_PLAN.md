# AllWrite 2.0 마케팅 및 배포 계획

## 1. 제품 개요

**AllWrite 2.0**은 수학 교육을 위한 대화형 기하학 및 그래프 도구입니다.

### 핵심 가치 제안
- 실시간 기하학 작도 및 동기화
- 직관적인 수학 학습 경험
- 교육용 무한 캔버스
- Windows, macOS, Android 지원

### 타겟 사용자
1. **학생** (중학교 ~ 고등학교)
2. **수학 교사** 및 강사
3. **학원/교육 기관**
4. **자기 학습자**

---

## 2. 배포 플랫폼 비교 및 추천

### 플랫폼별 비교

| 플랫폼 | 등록비 | 수수료 | 사용자 규모 | 추천도 |
|--------|--------|--------|-------------|--------|
| **GitHub Releases** | 무료 | 0% | 개발자 중심 | ★★★★★ |
| **itch.io** | 무료 | 0~10% (선택) | 인디 친화적 | ★★★★★ |
| **Gumroad** | 무료 | 10% | 크리에이터 중심 | ★★★★☆ |
| **Microsoft Store** | ~$19 | 15~30% | Windows 사용자 | ★★★☆☆ |
| **Steam** | $100 | 30% | 1.2억+ | ★★☆☆☆ |

### 추천 배포 전략 (단계별)

#### 1단계: 무료 배포 (즉시)
- **GitHub Releases**: 이미 설정됨, 오픈소스 커뮤니티 접근
- **itch.io**: 무료 등록, 인디 소프트웨어에 최적

#### 2단계: 유료 전환 고려 (사용자 피드백 후)
- **Gumroad**: 교육 콘텐츠 판매에 적합
- **자체 웹사이트**: Stripe/PayPal 연동

#### 3단계: 확장 (충분한 검증 후)
- **Microsoft Store**: Windows 사용자 접근성
- **Google Play Store**: Android 버전

---

## 3. 가격 전략

### 추천: Freemium 모델

교육용 소프트웨어 특성상 **Freemium 모델**이 적합합니다.

#### 무료 버전 (AllWrite Free)
- 기본 기하학 도구 (점, 선, 원, 다각형)
- 기본 펜/지우개
- 파일 저장/불러오기
- 무제한 사용

#### 유료 버전 (AllWrite Pro) - 제안 가격: $9.99~$19.99
- 모든 무료 기능 포함
- PDF/이미지 내보내기
- 고급 도형 (특수 다각형, 내분점 등)
- 수식 입력 및 그래프
- 우선 지원

#### 교육기관 라이선스 - 제안 가격: $99~$199/년 (최대 50명)
- 볼륨 라이선스
- 관리자 대시보드
- 기술 지원

### 가격 결정 시 고려사항

**경쟁 제품 가격대:**
- GeoGebra: 무료 (광고 기반)
- Desmos: 무료 (교육용)
- Notability: $14.99
- Concepts: $9.99/년

**추천 초기 전략:**
1. 완전 무료로 시작 (사용자 기반 구축)
2. 피드백 수집 후 Pro 기능 결정
3. 6개월~1년 후 유료화 검토

---

## 4. 광고 전략

### 광고 삽입 여부: 비추천

**이유:**
- 교육용 앱에서 광고는 사용자 경험 저하
- 학교/교사 추천 받기 어려움
- 수익 대비 브랜드 이미지 손상

### 대안: 후원/기부 모델
- GitHub Sponsors 연동
- Buy Me a Coffee 링크
- Patreon 페이지

---

## 5. 홍보 채널

### 즉시 실행 가능

#### 온라인 커뮤니티
- [ ] Reddit: r/math, r/learnmath, r/Teachers, r/education
- [ ] Discord: 수학 교육 서버들
- [ ] 페이스북: 수학 교사 그룹
- [ ] 네이버 카페: 수학 교사 모임, 학부모 커뮤니티

#### 개발자/제품 플랫폼
- [ ] Product Hunt 런칭
- [ ] Hacker News Show HN
- [ ] itch.io 게시

#### 교육 커뮤니티
- [ ] 인디스쿨 (한국 교사 커뮤니티)
- [ ] 에듀넷
- [ ] 수학사랑 등 교과 커뮤니티

### 중기 전략

#### 콘텐츠 마케팅
- [ ] 유튜브 튜토리얼 영상
- [ ] 블로그 포스트 (사용법, 활용 사례)
- [ ] 교사용 수업 자료 제공

#### SNS
- [ ] 트위터/X 계정 운영
- [ ] 인스타그램 (시각적 콘텐츠)
- [ ] 틱톡 (짧은 데모 영상)

---

## 6. 랜딩 페이지 구조

### 추천 플랫폼
- **GitHub Pages**: 무료, 간편
- **Vercel**: 무료, 빠름
- **Notion**: 빠른 제작 가능

### 페이지 구조

```
allwrite.app (또는 GitHub Pages)
├── 메인 (Hero)
│   ├── 제품명 + 태그라인
│   ├── 메인 스크린샷/GIF
│   └── 다운로드 버튼
│
├── 기능 소개
│   ├── 기하학 도구 (스크린샷 + 설명)
│   ├── 실시간 동기화 (GIF 데모)
│   ├── 그래프 기능 (스크린샷)
│   └── 펜/캔버스 (스크린샷)
│
├── 사용 방법
│   ├── 빠른 시작 가이드
│   ├── 단계별 튜토리얼 이미지
│   └── 비디오 튜토리얼 링크
│
├── 다운로드
│   ├── Windows (.exe)
│   ├── macOS (.dmg)
│   └── Android (Play Store/APK)
│
├── 스크린샷 갤러리
│
└── 푸터
    ├── GitHub 링크
    ├── 개발자 연락처
    └── 라이선스 정보
```

### 필요한 이미지 자료

#### 스크린샷 (필수)
1. [ ] 메인 화면 전체
2. [ ] 기하학 도형 작도 예시
3. [ ] 점 드래그 → 도형 변형 (GIF)
4. [ ] 펜 드로잉 예시
5. [ ] 수식 입력 화면
6. [ ] 다양한 도형 조합

#### 튜토리얼 이미지
1. [ ] 정다각형 그리기 단계 (1~4단계)
2. [ ] 원 그리기 단계
3. [ ] 중점/내분점 만들기

---

## 7. 실행 체크리스트

### Phase 1: 즉시 (1주 내)
- [ ] itch.io 계정 생성 및 페이지 설정
- [ ] GitHub Releases 정리
- [ ] 기본 스크린샷 촬영
- [ ] README 영문 버전 작성

### Phase 2: 단기 (2~4주)
- [ ] 랜딩 페이지 제작 (GitHub Pages)
- [ ] Product Hunt 준비
- [ ] 커뮤니티 홍보 시작
- [ ] 튜토리얼 영상 1개

### Phase 3: 중기 (1~3개월)
- [ ] 사용자 피드백 수집
- [ ] 기능 개선
- [ ] 유료화 여부 결정
- [ ] 교육기관 접촉

---

## 8. 예상 비용

| 항목 | 비용 | 비고 |
|------|------|------|
| 도메인 (선택) | $10~15/년 | 예: allwrite.app |
| GitHub Pages | 무료 | |
| itch.io | 무료 | |
| Product Hunt | 무료 | |
| Google Play 개발자 | $25 (1회) | Android 배포 시 |
| Microsoft Store | ~$19 (1회) | Windows Store 배포 시 |

**최소 비용: $0** (기존 플랫폼만 사용)
**추천 비용: ~$50** (도메인 + Play Store)

---

## 9. 성공 지표 (KPI)

### 1개월 목표
- GitHub Stars: 100+
- 다운로드: 500+
- itch.io 조회: 1,000+

### 3개월 목표
- GitHub Stars: 500+
- 다운로드: 2,000+
- 활성 사용자: 200+
- 리뷰/피드백: 20+

### 6개월 목표
- GitHub Stars: 1,000+
- 다운로드: 10,000+
- 유료 전환 결정

---

## 참고 자료

- [Steam vs itch.io 비교](https://epicgamejourney.com/2024/07/19/steam-vs-itch-io-which-platform-is-better-for-indie-pc-game-developers/)
- [인디 게임 배포 플랫폼](https://www.slant.co/topics/1782/~best-distribution-platforms-for-an-indie-desktop-game)
- [Freemium 가격 전략](https://www.highalpha.com/blog/freemium-pricing-examples-and-models)
- [EdTech 마케팅 전략](https://saassy.agency/edtech-marketing-strategy/)
- [K-12 교육 마케팅](https://agile-ed.com/resources/empowering-education-solution-providers-with-effective-k-12-marketing-strategies/)

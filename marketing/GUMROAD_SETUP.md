# Gumroad 판매 설정 가이드

## 1. Gumroad 계정 생성

1. https://gumroad.com 접속
2. "Start selling" 클릭
3. 이메일로 가입 또는 Twitter/Google 연동
4. 프로필 설정

---

## 2. 판매자 정보 설정

### 프로필 설정
1. Settings → Profile
2. 입력 정보:
   - **Name**: Binary 또는 AllWrite
   - **Bio**: "Developer of AllWrite - Interactive Math Geometry Tool"
   - **Profile picture**: 로고 이미지

### 결제 설정
1. Settings → Payments
2. **Payout method** 선택:
   - PayPal (추천, 빠름)
   - 또는 Stripe (직접 은행 연결)
3. 세금 정보 입력 (W-8BEN 양식 - 한국 거주자)

---

## 3. 제품 등록

### 새 제품 만들기
1. Dashboard → "New product" 클릭
2. **Digital product** 선택

### 기본 정보

**Name:**
```
AllWrite 2.0 - Interactive Math Geometry Tool
```

**Price:**
```
$14.99
```
(또는 "Pay what you want" 최소 $9.99)

**Description:**
```markdown
# AllWrite 2.0

Interactive geometry and graphing tool for math education.

## What You Get
- Windows installer (.exe)
- macOS installer (.dmg)
- Lifetime license (no subscription)
- Free updates

## Key Features
- Real-time geometry construction
- Point-shape synchronization
- Freehand drawing with pressure sensitivity
- Infinite canvas
- PDF/Image export

## System Requirements
- Windows 10/11 or macOS 11+
- 4GB RAM
- 200MB disk space

## Support
- Email: randomwalk1225@gmail.com
- GitHub Issues (for bug reports)

---

**한국어 안내**
한국에서 구매 시 토스/카카오페이 결제도 가능합니다.
문의: randomwalk1225@gmail.com
```

### 파일 업로드

**Content** 탭에서:
1. "Add content" → "Files"
2. 업로드할 파일:
   - `AllWrite2-Setup-2.0.0.exe` (Windows)
   - `AllWrite2-2.0.0.dmg` (macOS) - 있다면
   - `README.pdf` (선택, 사용 설명서)

### 커버 이미지

**Thumbnail** 섹션:
- 권장 크기: 1280x720 또는 1600x900
- 내용: 앱 스크린샷 + 로고

### 추가 설정

**Checkout** 탭:
- ✅ "Collect customer email"
- ✅ "Send receipt"

**Discover** 탭:
- Tags: `math`, `education`, `geometry`, `software`, `desktop app`
- ✅ "List on Gumroad Discover" (선택)

---

## 4. 가격 전략

### 옵션 A: 고정 가격
```
$14.99 (약 20,000원)
```

### 옵션 B: Pay What You Want
```
최소: $9.99
권장: $14.99
```
- 더 많이 지불하고 싶은 사람도 있음
- 평균 구매가가 높아질 수 있음

### 옵션 C: 할인 코드 활용
- `LAUNCH20` → 20% 할인 (런칭 프로모션)
- `STUDENT` → 30% 할인 (학생용)
- `TEACHER` → 50% 할인 (교사용)

할인 코드 설정: Product → Edit → Checkout → "Offer codes"

---

## 5. 한국 결제 대안 (Gumroad 외)

Gumroad는 해외 결제라 일부 한국 사용자에게 불편할 수 있습니다.

### 병행 옵션
1. **토스페이먼츠** (https://tosspayments.com)
   - 한국 결제 전문
   - 개발 연동 필요

2. **토스 송금** (간단)
   - toss.me/allwrite 로 송금 받고
   - 이메일로 다운로드 링크 수동 발송

3. **카카오페이 송금**
   - 마찬가지로 수동 처리

### 추천
- 해외: Gumroad
- 한국: 토스 송금 + 수동 발송 (초기)
- 규모 커지면: 토스페이먼츠 연동

---

## 6. 제품 URL

등록 완료 후 URL 형식:
```
https://gumroad.com/l/allwrite2
```

또는 커스텀 도메인 연결 가능.

---

## 7. 출시 체크리스트

- [ ] Gumroad 계정 생성
- [ ] 프로필 및 결제 설정
- [ ] 제품 등록 (이름, 설명, 가격)
- [ ] 설치 파일 업로드 (.exe, .dmg)
- [ ] 커버 이미지 업로드
- [ ] 할인 코드 생성 (선택)
- [ ] 테스트 구매 (본인 카드로)
- [ ] 랜딩 페이지에 구매 링크 추가

---

## 8. 판매 후 관리

### 고객 지원
- Gumroad 내 메시지 기능 활용
- 이메일 문의 대응

### 업데이트 배포
1. Product → Edit → Content
2. 새 파일 업로드 (기존 파일 교체)
3. 기존 구매자에게 이메일 발송 (선택)

### 환불 정책
- Gumroad 기본: 30일 환불 가능
- Settings에서 변경 가능

---

## 9. 매출 확인 및 정산

### Dashboard
- 일별/월별 매출 확인
- 구매자 목록

### 정산
- 매주 금요일 자동 정산 (PayPal)
- 또는 수동 출금 요청

### 수수료
- Gumroad: **10%**
- 예: $14.99 판매 → $13.49 수령

---

## 10. 세금 안내

### 미국 세금
- W-8BEN 제출 시 미국 원천징수 면제 (한-미 조세협약)

### 한국 세금
- 해외 수입으로 종합소득세 신고 필요
- 연 수입이 적으면 크게 신경 안 써도 됨
- 규모 커지면 세무사 상담 권장

---

## Gumroad 페이지 예시

참고할 만한 유사 제품:
- https://gumroad.com/discover?query=desktop%20app
- https://gumroad.com/discover?query=education%20software

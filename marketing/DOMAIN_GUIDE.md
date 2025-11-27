# 도메인 구매 및 설정 가이드

## 1. 추천 도메인 이름

### 최우선 추천
| 도메인 | 예상 가격 | 장점 |
|--------|-----------|------|
| `allwrite.app` | ~$14/년 | .app은 앱에 적합, HTTPS 기본 |
| `allwrite.io` | ~$32/년 | 기술 제품에 인기 |
| `allwrite.dev` | ~$12/년 | 개발자 친화적 |

### 대안
| 도메인 | 예상 가격 | 비고 |
|--------|-----------|------|
| `allwrite-math.com` | ~$12/년 | .com이지만 긴 이름 |
| `getallwrite.com` | ~$12/년 | "get" 접두사 패턴 |
| `allwrite.kr` | ~₩22,000/년 | 한국 대상 시 |

---

## 2. 도메인 등록 업체 비교

### 해외 (추천)

#### Namecheap (★★★★★ 추천)
- 웹사이트: https://www.namecheap.com
- 장점: 저렴, WhoisGuard 무료, 간편한 DNS 관리
- .app 도메인: ~$13.98/년
- .io 도메인: ~$32.98/년

#### Cloudflare Registrar (★★★★★)
- 웹사이트: https://www.cloudflare.com/products/registrar/
- 장점: 원가 판매 (마진 없음), 빠른 DNS
- .app 도메인: ~$14/년
- 참고: Cloudflare 계정 필요

#### Google Domains → Squarespace
- Google Domains가 Squarespace로 이전됨
- https://domains.squarespace.com

#### Porkbun (★★★★☆)
- 웹사이트: https://porkbun.com
- 장점: 매우 저렴, 무료 SSL, WHOIS 프라이버시 포함

### 국내

#### 가비아
- 웹사이트: https://www.gabia.com
- .com: ₩16,500/년
- .kr: ₩22,000/년

#### 호스팅케이알
- 웹사이트: https://www.hosting.kr
- 가격 경쟁력 있음

---

## 3. 구매 절차 (Namecheap 예시)

### Step 1: 도메인 검색
1. https://www.namecheap.com 접속
2. 원하는 도메인 검색 (예: `allwrite.app`)
3. 사용 가능 여부 확인

### Step 2: 장바구니 추가
1. "Add to cart" 클릭
2. WhoisGuard (무료) 활성화 확인
3. Auto-Renew 설정 (선택)

### Step 3: 결제
1. 계정 생성 또는 로그인
2. 결제 정보 입력
3. 결제 완료

### Step 4: DNS 설정 (GitHub Pages 연결)
1. Dashboard → Domain List → Manage
2. "Advanced DNS" 탭
3. 기존 레코드 삭제 후 아래 추가:

```
Type     Host    Value                    TTL
A        @       185.199.108.153          Auto
A        @       185.199.109.153          Auto
A        @       185.199.110.153          Auto
A        @       185.199.111.153          Auto
CNAME    www     randomwalk1225.github.io Auto
```

---

## 4. Cloudflare로 구매 시 (권장)

### 장점
- 원가 판매 (마진 없음)
- 무료 SSL/CDN
- 빠른 DNS
- DDoS 보호

### 절차
1. https://dash.cloudflare.com 가입
2. "Registrar" → "Register Domains"
3. 도메인 검색 및 구매
4. DNS는 자동으로 Cloudflare에서 관리

### Cloudflare DNS 설정 (GitHub Pages)
```
Type     Name    Content                  Proxy
A        @       185.199.108.153          DNS only
A        @       185.199.109.153          DNS only
A        @       185.199.110.153          DNS only
A        @       185.199.111.153          DNS only
CNAME    www     randomwalk1225.github.io DNS only
```

---

## 5. GitHub Pages에 커스텀 도메인 연결

### Step 1: CNAME 파일 생성
프로젝트 루트 또는 docs 폴더에 `CNAME` 파일 생성:
```
allwrite.app
```
(www 없이 루트 도메인만 입력)

### Step 2: GitHub 설정
1. Repository → Settings → Pages
2. "Custom domain"에 도메인 입력 (예: `allwrite.app`)
3. "Enforce HTTPS" 체크 (DNS 전파 후 활성화됨)

### Step 3: DNS 전파 대기
- 보통 10분~48시간 소요
- https://dnschecker.org 에서 확인 가능

---

## 6. 예상 비용 정리

### 최소 비용 (연간)
| 항목 | 비용 |
|------|------|
| 도메인 (.dev) | ~$12 |
| GitHub Pages 호스팅 | 무료 |
| SSL | 무료 (GitHub/Cloudflare) |
| **총합** | **~$12/년** |

### 추천 구성 (연간)
| 항목 | 비용 |
|------|------|
| 도메인 (.app) | ~$14 |
| Cloudflare (CDN/보안) | 무료 |
| GitHub Pages | 무료 |
| **총합** | **~$14/년** |

---

## 7. 구매 전 체크리스트

- [ ] 원하는 도메인 사용 가능 여부 확인
- [ ] 가격 비교 (Namecheap vs Cloudflare vs Porkbun)
- [ ] WHOIS 프라이버시 포함 여부 확인
- [ ] 자동 갱신 설정 여부 결정
- [ ] 결제 수단 준비 (해외 결제 가능 카드)

---

## 8. 추천 조합

**가장 추천하는 설정:**
1. **Cloudflare**에서 `allwrite.app` 구매 (~$14/년)
2. **Cloudflare DNS** 사용 (무료 CDN, 보안)
3. **GitHub Pages**로 호스팅 (무료)

이렇게 하면 연간 ~$14만으로 전문적인 웹사이트 운영이 가능합니다.

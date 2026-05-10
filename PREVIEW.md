# 테더켓 거래소 미리보기 가이드

이 저장소는 **중앙화 코인 거래소(CEX)** 예제입니다. **P2P 거래소가 아닙니다.**

만들어진 화면과 API 연동을 로컬에서 바로 확인하는 방법입니다.

### 로컬 전용 포트 (다른 레포 기본값과 겹치지 않도록 고정)

| 용도 | 주소 |
|------|------|
| 웹 (Vite dev) | `http://localhost:5720` |
| 빌드 미리보기 | `http://localhost:5721` |
| 백엔드 API 직접 호출 | `http://localhost:4720` |

브라우저에서는 **`/api` → Vite 프록시가 백엔드 4720으로** 넘깁니다.

### 인터넷에서 열리는 주소(공유용)

고정 도메인은 클라우드에 배포해야 생깁니다. **당장 다른 사람에게 줄 주소**는 터널로 만듭니다.

1. 터미널 A — 웹 + API 같이:

```bash
npm run dev:full
```

2. 터미널 B — 공개 URL 발급:

```bash
npm run tunnel
```

터미널에 **`https://xxxx.loca.lt`** 같은 주소가 나옵니다 → 그게 미리보기 주소입니다.

- 처음 접속 시 브라우저에서 IP 확인 페이지가 뜰 수 있습니다(localtunnel 특성).
- 터널을 켠 PC와 `npm run dev:full`이 **계속 켜져 있어야** 링크가 동작합니다.

빌드 미리보기(`5721`)에 터널을 붙이려면 `npm run preview:full` 실행 후 다른 터미널에서 `npm run tunnel:preview`

## 한 번에 실행 (추천)

프로젝트 루트에서:

```bash
npm install
npm install --prefix backend
npm run dev:full
```

- 웹 UI: 브라우저가 자동으로 열립니다. 보통 `http://localhost:5720`
- 백엔드 API: `http://localhost:4720`

로그인 후 거래·출금·관리자 기능은 백엔드가 떠 있어야 동작합니다.

## 따로 실행할 때

터미널 1 (API):

```bash
cd backend
npm install
npm run dev
```

터미널 2 (웹):

```bash
npm install
npm run dev
```

## 빌드 결과만 미리보기 (`vite preview`)

API 없이 정적 화면만 보려면:

```bash
npm run build
npm run preview
```

API까지 같이 보려면:

```bash
npm run preview:full
```

- 웹: `http://localhost:5721` (또는 터미널에 표시된 주소)
- API: `http://localhost:4720`

## 빠른 테스트 계정

| 역할 | 이메일 | 비밀번호 |
|------|--------|----------|
| 슈퍼관리자 | super@tetherget.io | pass1234 |
| 운영 | ops@tetherget.io | pass1234 |
| CS | cs@tetherget.io | pass1234 |
| 트레이더 | trader@tetherget.io | pass1234 |

관리자 OTP 테스트 코드: `123456`

## 확인하면 좋은 화면 순서

1. 로그인/회원가입 → 로그인
2. 거래소 / 현물 / 선물 → 주문 입력
3. 입출금 → 출금 요청
4. 관리자 → OTP 인증 → 출금 승인 / 정산 / KYC

네트워크·방화벽에서 위 포트가 막혀 있으면 접속이 안 될 수 있습니다.

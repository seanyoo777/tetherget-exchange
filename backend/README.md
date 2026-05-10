# Tetherget Backend Skeleton

## Run

```bash
npm install
npm run dev
```

Default server: `http://localhost:4720` (이 레포 로컬 전용 포트)

## Environment

운영·스테이징에서는 `backend/.env.example`를 복사해 `.env`를 만들고 값을 채우세요 (`cp .env.example .env`). 분리 배포 시 프론트 빌드의 `VITE_API_BASE`와 맞추려면 이쪽의 `CORS_ORIGINS`에 프론트 공개 URL을 포함해야 합니다. 루트 `.env.example`에는 프론트 변수(`VITE_*`) 설명이 함께 있습니다.

## Mock Accounts

- `super@tetherget.io / pass1234`
- `ops@tetherget.io / pass1234`
- `cs@tetherget.io / pass1234`
- `trader@tetherget.io / pass1234`

## Core APIs

- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/order`
- `GET /api/order`
- `GET /api/wallet/:userId`
- `GET /api/admin/audit` (header `x-role`)
- `GET /api/admin/settlement` (header `x-role`)
- `POST /api/admin/settlement/:id/progress` (header `x-role`)

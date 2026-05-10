# Tetherget Backend Skeleton

## Run

```bash
npm install
npm run dev
```

Default server: `http://localhost:4000`

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

# API 전용 이미지 — 워크스페이스 루트에서 빌드 후 backend 실행
FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/contracts ./shared/contracts
COPY backend ./backend

RUN npm ci && npm run build:deploy

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

CMD ["npm", "run", "start:api"]

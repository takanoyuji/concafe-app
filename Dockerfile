FROM node:20-slim AS builder
WORKDIR /app

RUN apt-get update && \
    apt-get install -y python3 make g++ --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
# ネットワーク不安定時用: リトライ・タイムアウト延長
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm ci

COPY . .

# ロゴを app/assets に配置（ビルドに含め public 配信に依存しない）
RUN mkdir -p app/assets && cp "public/images/名称未設定星狼 1.jpg" "app/assets/logo.jpg"

# ビルド時のメモリ上限（ホストのRAMに合わせること。2GB なら 1024〜1536、4GB 以上なら 4096）
ENV NODE_OPTIONS=--max-old-space-size=1536

# GA4 測定ID（ビルド時に埋め込む。未指定ならクライアントでGAは無効）
ARG NEXT_PUBLIC_GA_ID
ENV NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID

ENV DATABASE_URL=file:./dev.db
RUN npx prisma generate
RUN npx prisma migrate deploy
RUN npm run build

FROM node:20-slim
WORKDIR /app

RUN apt-get update && \
    apt-get install -y openssl --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/prisma.config.ts ./

RUN mkdir -p /data /app/public/images/cast

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# 本番: DB を永続ボリューム /data に置く（.env で上書き可）
ENV DATABASE_URL=file:/data/concafe.db

# root で実行（Prisma が node_modules に書き込むため）
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts && npm start"]

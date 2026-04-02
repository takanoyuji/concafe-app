This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Docker でローカルにビルド・起動

手元（WSL またはローカル）でビルド・起動して動作確認してからサーバに反映する想定です。

**事前に .env を用意する**

- プロジェクトルートに `.env` を作成し、少なくとも **`NEXT_PUBLIC_BASE_URL`** を入れておく（例: `https://vliverlab.com`）。ビルド時にこの値が埋め込まれます。
- 任意: `NEXT_PUBLIC_GA_ID`（GA4 測定 ID）、SMTP 関連、`JWT_SECRET` など。例は `.env.example` をコピーして編集。

```bash
cp .env.example .env
# .env を編集して NEXT_PUBLIC_BASE_URL を設定

docker compose up -d --build
```

起動後は [http://localhost:3000](http://localhost:3000) で確認。停止は `docker compose down`（データはボリューム `app_data` に残ります）。

サーバへの反映手順（イメージの push/pull や save/load、バックアップ）は [DEPLOY.md](./DEPLOY.md) を参照。

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## デプロイ

本番サーバへのデプロイは [DEPLOY.md](./DEPLOY.md) を参照（手元で Docker ビルド → イメージをサーバに渡す → サーバでは pull/load と up のみ）。

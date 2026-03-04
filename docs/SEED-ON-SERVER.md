# サーバーで seed を実行する（管理者ユーザー作成）

サーバーの DB に初期データ（管理者ユーザー・店舗・称号など）を投入する手順です。

## 1. コードを最新にしてイメージを再ビルド

**重要:** `git pull` だけではコンテナ内のコードは変わらないため、**必ず再ビルド**してください。

```bash
cd /opt/apps/concafe-app
git pull origin main
docker compose build --no-cache
docker compose up -d
```

## 2. コンテナ内で seed を実行

```bash
docker compose exec app npx prisma db seed
```

- 管理者 **xinglang22@gmail.com**（パスワード: `xxx123`）が作成または更新されます。
- 既に同じメールのユーザーがいれば `role: ADMIN` と `emailVerified: true` に更新されます。
- 店舗・称号マスタも upsert されます。

## 3. 管理者のメール・パスワードを変えたい場合

サーバーの `.env` に追加してから seed を実行します。

```env
ADMIN_EMAIL=別のメール@example.com
ADMIN_PASSWORD=別のパスワード
```

コンテナは .env を読むので、その状態で再度:

```bash
docker compose exec app npx prisma db seed
```

## 注意

- 初回ログイン後、`mustChangePassword` が true の場合はパスワード変更を促されます。
- 本番では `ADMIN_PASSWORD` を必ず強いパスワードに変更してください。

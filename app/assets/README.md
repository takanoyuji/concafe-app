# ロゴ画像

ビルドで参照するロゴはここに `logo.jpg` として置きます。

**初回のみ（リポジトリルートで）:**

```bash
cp "public/images/名称未設定星狼 1.jpg" "app/assets/logo.jpg"
```

Docker ビルド時は Dockerfile の RUN で自動生成されるため、このコピーはローカル用です。

# プロンプト: 会員登録が「送信中...」で止まる原因を調査

本番サーバにデプロイしたアプリで、会員登録（サインアップ）フォームが「送信中...」のまま完了しない問題の原因を切り分け・修正するためのプロンプトです。

---

## プロンプト（コピー用）

```
このプロジェクトは Next.js アプリで、Docker で本番サーバ（xing-lang.com）にデプロイして動かしている。

**現象**
- 会員登録ページ（/auth/signup）でメール・パスワードを入力し「確認メールを送信」を押すと、ボタンが「送信中...」のまま戻らない（レスポンスが返ってこない）。

**調査してほしいこと**

1. **API の流れの確認**
   - サインアップは `app/api/auth/signup/route.ts` の POST。ユーザー作成 → 確認用トークン作成 → `sendVerificationEmail()` でメール送信 → 201 を返す。どこでブロックされているか（DB / メール送信 / その他）を特定してほしい。

2. **メール送信まわり**
   - 確認メールは `lib/email.ts` の `sendVerificationEmail` 経由で送っている。本番では SMTP（例: AWS SES）を使う想定。サーバの .env に SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM が正しく設定されているか、また送信処理でタイムアウトやエラーになっていないかを確認してほしい。

3. **サーバ側の確認方法**
   - コンテナログ: `docker compose -f docker-compose.pull.yml logs -f app` で、サインアップリクエスト時にエラーやスタックトレースが出ていないか。
   - 必要なら、signup の route や sendVerificationEmail 内にログを追加して、どこまで処理が進んでいるか分かるようにしてほしい。

4. **フロント側**
   - `/auth/signup` は `app/auth/signup/page.tsx`。API が長時間応答しない場合、フロントは「送信中...」のままになる。タイムアウトやエラー表示の有無、fetch の URL（本番の NEXT_PUBLIC_BASE_URL や相対パス）が正しいかも確認してほしい。

5. **原因に応じた修正**
   - メール送信のタイムアウトや SMTP 設定不備なら、設定修正やタイムアウト値の見直し。
   - エラー時でも 500 などで返すようにして、フロントで「送信に失敗しました」等を表示できるようにする。

上記を踏まえ、コードベースとデプロイ前提で原因を特定し、修正案（コード変更やサーバ設定の手順）を出してほしい。
```

---

## 補足（サーバで手動確認するとき）

- コンテナログ: `docker compose -f docker-compose.pull.yml logs -f app`
- .env の SMTP 設定: `grep SMTP /opt/apps/concafe-app/.env`（値は伏せて表示される想定）
- ブラウザの開発者ツール → Network で `/api/auth/signup` の POST が Pending のままか、何秒で失敗しているか確認すると原因の切り分けに役立つ。

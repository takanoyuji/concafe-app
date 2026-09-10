# 作業ログ 2026-09-10 — 公式HPの予約導線と、予約フォームの入力項目

前日デプロイした席予約（第1段階）の入口と入力項目を、運用に合わせて3回に分けて直した。
本番へのデプロイもこの日に3回行っている。

| # | 内容 | コミット | イメージ |
|---|---|---|---|
| 1 | 公式HPの予約導線を `/reserve` に差し替え | `0b3058a` | `concafe-app-app:reserve-link-20260910` |
| 2 | お客様向けフォームから自由記入欄を削除 | `1243eef` | `concafe-app-app:reserve-form-20260910` |
| 3 | 遠隔ドリンクの購入ID欄を追加 | `41e7cb4` | `concafe-app-app:purchase-id-20260910` |

---

## 1. 公式HPの予約導線を `/reserve` に差し替えた

ヘッダーのRESERVEは前日から `/reserve` に入っていたが、**LPの本文側は「ご予約はこちら」が公式LINEへのリンクのままだった**。
予約は一律で公式HPのフォームに寄せる運用（2026-09-09決定）と食い違うので直した。

| 場所 | 変更前 | 変更後 |
|---|---|---|
| `components/lp/HeroSection.tsx` | 「公式LINE・ご予約はこちら」→ LINE | 「ご予約はこちら」→ `/reserve` を新設。LINEは「公式LINE（友だち追加）」 |
| `components/lp/SnsSection.tsx` | 「公式LINE／ご予約はこちら」→ LINE | 「席のご予約／ご予約はこちら」→ `/reserve` を新設。LINE側は「友だち追加はこちら」 |

**LINEのリンクは消さずに残した。** 公式LINEは友だち追加の入口でもあるので、
href だけ `/reserve` に差し替えると友だち追加の導線が無くなる。

---

## 2. お客様向けフォームから自由記入欄を削除した

「ご要望（席のご希望、記念日など）」の textarea を外した。
入力項目が増えるほど申し込みが落ちるのと、**承認前の自由記入が「約束した」と受け取られる余地**を作らないため。
必要なら公式LINEのトークで伺う。

- `ReservationSchema`（お客様向け）から `note` を外した。zod は未知のキーを落とすので、
  **直接POSTされても保存されない**
- `Reservation.note` 列は残した。電話・DMで受けた分を管理画面から手入力するときの
  店舗メモとして使うため、`AdminReservationSchema` 側に `note` を移した
- 台帳の表示を「ご要望:」→「メモ:」に変更

---

## 3. 遠隔ドリンクの購入ID欄を追加した

遠隔で買ってくれた人を**承認で優先する**ために、BASEの注文IDを任意で自己申告してもらう。

```
遠隔ドリンクの購入ID（任意）
[ 1AE7F1F358D8940C ]
BASEの注文確認メールに記載の16桁の番号です。
※購入しなくても予約申請はできます
```

### ⚠️ システムは照合していない

**concafe-app は BASE の API を持っていない。** 入力値は自己申告のまま台帳に載り、
他人の注文IDを書くこともできる。台帳に出た値を店舗が「購入確認済み」と受け取ると、
確認していないものを確認したことにしてしまう。

そのため:

- 台帳の詳細は「**購入ID（未照合）**」と表示し、
  「お客様の自己申告です。承認を優先する前にBASEの管理画面で突き合わせてください」を併記する
- 行には「遠隔購入の申告あり」バッジを出す。**申告があった事実**しか表していない
- `looksLikeBasePurchaseId()` は16進16桁かを見るだけ。**弾くための判定ではない**。
  形が違っても保存し、判定結果は台帳の⚠️警告にだけ使う
  （BASE以外の経路や表記ゆれで申し込めなくなるほうが損なため）
- 保存時に `normalizePurchaseId()` で前後の空白を落として大文字に寄せる（後で照合するときの表記ゆれ対策）

BASEの注文IDの形は、`secretary/input/星狼/注文データ/` のCSVで確認した16進16桁の大文字（例 `1AE7F1F358D8940C`）。

### 承認の並び順は変えていない

バッジで見分ける形にした。未対応が多くて埋もれるようなら、並び替えかフィルタを足す。

---

## 4. デプロイ

3回とも同じ手順。**開発機でビルドしてイメージを転送**（本番でビルドしない）。

```bash
ssh prod-server-deploy '/opt/apps/concafe-app/scripts/backup-db.sh'   # 毎回とった
docker build --build-arg NEXT_PUBLIC_GA_ID=G-B6LN2JP5N1 -t concafe-app-app:<tag> .
docker save concafe-app-app:<tag> | gzip -1 | ssh prod-server-deploy 'gunzip | docker load'
ssh prod-server-deploy "cd /opt/apps/concafe-app && sed -i 's|image: ...|image: ...|' compose.yml && docker compose up -d"
```

3回目は列を足すマイグレーションが1本入っている。起動ログに
`All migrations have been successfully applied.` が出て、コンテナ内に
`20260910000000_add_reservation_purchase_id` があることを確認した。
⚠️ **イメージを戻しても列は残る。**

### `production` ブランチを本番と揃えた

予約機能（`c18cc90`）も含めて、本番で動いているものが `feature/reservation` にしか無い状態だった。
`production` へ `--ff-only` で早送りし、`origin/production` まで push した。
以後の3コミットは `production` に直接積んでいる。

---

## 5. 確認の仕方（毎回やったこと）

CLAUDE.md の「動いたの確認ルール」に沿って、**画面ではなくDOMで数えた**。

- `tsc --noEmit` と `npm run build` は **`tail` で末尾をそのまま読む**（`grep` で絞ると `Type error:` を落とす）
- テストは全件。134件 → 139件 → **142件**（購入IDのケースを6件追加）
- 本番ビルドを別ポート(3111)で起動し、**起動ログに `EADDRINUSE` が無いこと**を毎回見た
- `curl` でHTMLを取り、**リンクと文言を個数で数えた**（例: `href="/reserve"` が3本、`<textarea>` が0個）
- 最後に本番のURLを叩いて同じ数え方をし、スクリーンショットは見栄えの確認にだけ使った

### ハマったこと: reveal アニメーションでスクリーンショットが真っ暗になる

LPの下のセクションは `data-reveal` で `opacity:0` から入る。ヘッドレスChromeでは
IntersectionObserver が発火せず、**縦16000pxの窓で撮ってもヒーロー以外は何も写らない**
（しかもヒーローが `min-h-screen` なので、窓を高くするとヒーロー自体が16000pxになる）。

`[data-reveal]{opacity:1!important}` と「対象セクション以外を `display:none`」を差し込む
薄いプロキシ（3112番）を挟んで撮った。ローカルの検証サーバは `127.0.0.1` ではWindows版Chromeから
見えないので、`hostname -I` のWSLのIPを渡す。

### 検証用DBの用意

`dev.db` はスキーマが古く（`Cast.retired` が無い）、`prisma db push` も
`UNIQUE constraint failed: Cast.castCode` で通らない。
**本番のバックアップDBをコピーして `DATABASE_URL` で差し替えて確認し、確認後に削除した。**
顧客データを含むので手元に残さない。

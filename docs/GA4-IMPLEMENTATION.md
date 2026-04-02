# GA4 実装メモ

## 1. 変更したファイル一覧

| ファイル | 変更内容 |
|----------|----------|
| `lib/analytics.ts` | **新規** - gtag 型定義・pageview/event 共通関数・5種イベントラッパー |
| `components/analytics/GoogleAnalytics.tsx` | **新規** - GA スクリプト読み込みとルート変更時の page_view 送信 |
| `components/analytics/CastClickLink.tsx` | **新規** - キャストリンク用ラッパー（click_cast 送信） |
| `components/analytics/CastDetailSnsLinks.tsx` | **新規** - キャスト詳細のSNSリンク（click_sns 送信） |
| `app/layout.tsx` | GoogleAnalytics コンポーネントを body 直下に追加 |
| `components/lp/AccessSection.tsx` | Google Maps リンクに click_map を付与 |
| `components/lp/SnsSection.tsx` | "use client" 追加、LINE/SNS リンクに click_line / click_sns を付与 |
| `components/lp/CastTabs.tsx` | キャストカードの Link に click_cast を付与 |
| `app/store/[slug]/page.tsx` | 在籍キャスト・ランキングのリンクを CastClickLink に変更 |
| `app/cast/page.tsx` | キャストカードのリンクを CastClickLink に変更 |
| `app/cast/[id]/page.tsx` | SNS ブロックを CastDetailSnsLinks に差し替え |
| `app/ranking/page.tsx` | ランキングのキャストリンクを CastClickLink に変更 |
| `app/ranking/[slug]/page.tsx` | 同上 |

## 2. 各ファイルの変更内容要約

- **lib/analytics.ts**: `NEXT_PUBLIC_GA_ID` 未設定時は何もしない。`pageview(path)`、`event(name, params)`、および `clickMap` / `clickLine` / `clickTel` / `clickSns` / `clickCast` を提供。`window.gtag` の型を global で宣言。
- **GoogleAnalytics.tsx**: `next/script` で gtag.js を読み込み、初期 config は `send_page_view: false`。`usePathname()` の変更で `pageview(pathname)` を送信。
- **CastClickLink**: `Link` のラッパー。クリック時に `clickCast(castName)` を実行してから遷移。
- **CastDetailSnsLinks**: キャスト詳細の X/Instagram/TikTok リンクを表示し、クリック時に `clickSns(snsType, "cast:{castName}")` を送信。
- **AccessSection**: 「Google Maps で開く」の `<a>` に `onClick={() => clickMap(store.name)}` を追加。
- **SnsSection**: `"use client"` を付け、LP の X/Instagram/TikTok/YouTube/EC に `clickSns(type, "lp")`、LINE 2種に `clickLine("予約・お問い合わせ")` / `clickLine("無人営業のご予約")` を追加。
- **CastTabs**: キャストカードの `Link` に `onClick={() => clickCast(cast.name)}` を追加。
- **store/cast/ranking 各ページ**: キャストへのリンクを `CastClickLink` に統一（castName を渡す）。

## 3. 実装コード（主要部分）

### lib/analytics.ts（抜粋）

- `getGaId()` / `isGaEnabled()`: ID 取得・有無判定
- `pageview(path)`: `gtag('config', id, { page_path: path })`
- `event(name, params)`: `gtag('event', name, params)`（undefined は除外）
- `clickMap(locationName)` → event `click_map` / `location_name`
- `clickLine(locationName)` → event `click_line` / `location_name`
- `clickTel(locationName)` → event `click_tel` / `location_name`
- `clickSns(snsType, locationName)` → event `click_sns` / `sns_type`, `location_name`
- `clickCast(castName)` → event `click_cast` / `cast_name`

### イベント送信箇所

- **click_map**: AccessSection「Google Maps で開く」（location_name = 店舗名）
- **click_line**: SnsSection「ご予約・お問い合わせ」「無人営業のご予約」
- **click_tel**: 現状コード内に電話リンクなし。将来 `tel:` を設置する箇所で `clickTel(locationName)` を呼ぶ。
- **click_sns**: SnsSection（lp）、CastDetailSnsLinks（cast:キャスト名）
- **click_cast**: CastTabs、store/[slug]、cast、ranking、ranking/[slug] の各キャストリンク

## 4. .env.local に追加すべき内容

```env
# GA4 測定ID（未設定の場合は GA を読み込まない）
NEXT_PUBLIC_GA_ID=G-F9FKY7CKMM
```

本番では Vercel/サーバーの環境変数に同じキーで設定する。

## 5. 動作確認手順

1. `.env.local` に `NEXT_PUBLIC_GA_ID=G-F9FKY7CKMM` を追加し、`npm run dev` で起動。
2. ブラウザでトップ → 各ページへ遷移し、GA リアルタイムで「ページビュー」が増えることを確認。
3. 以下を順にクリックし、リアルタイムの「イベント」に指定名が出現することを確認。
   - ACCESS の「Google Maps で開く」→ `click_map`
   - FOLLOW US の LINE「ご予約・お問い合わせ」→ `click_line`
   - FOLLOW US の X / Instagram / TikTok 等 → `click_sns`
   - キャストカード（LP・キャスト一覧・店舗・ランキング）→ `click_cast`
   - キャスト詳細の SNS リンク → `click_sns`（location が cast:名前）
4. `NEXT_PUBLIC_GA_ID` を削除または空にして再起動すると、gtag が読み込まれずエラーにならないことを確認。

## 6. GA リアルタイムで確認すること

- **ページビュー**: ページ遷移のたびに 1 件ずつ増える。
- **イベント**（イベント名でフィルタ）:
  - `click_map`（パラメータ: location_name）
  - `click_line`（location_name）
  - `click_tel`（将来 tel リンクを付けた場合）
  - `click_sns`（sns_type, location_name）
  - `click_cast`（cast_name）

「イベント」一覧で上記名が表示され、パラメータが正しく送られているか確認する。

## 7. 今後コンバージョン設定すべきイベントの提案

- **click_line（予約・お問い合わせ）**: LINE 相談・予約入口としてコンバージョンに設定するとよい。
- **click_line（無人営業のご予約）**: 無人営業予約のコンバージョン用。
- **click_cast**: キャストへの関心として、重要度の高いイベントならコンバージョン候補。
- **click_map**: 店舗への来店意向の代理指標としてコンバージョン候補にできる。

GA4 管理画面 → 設定 → コンバージョン → 「新規コンバージョン」で、上記イベント名を選択してコンバージョンとしてマークする。

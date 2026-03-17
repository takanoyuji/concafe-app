# GA4 導入ドキュメント

## 1. 変更したファイル一覧

| 種別 | ファイル |
|------|----------|
| **新規** | `lib/analytics.ts` |
| **新規** | `components/GoogleAnalytics.tsx` |
| **新規** | `components/CastLink.tsx` |
| **新規** | `components/MapLink.tsx` |
| **新規** | `components/SnsLink.tsx` |
| **変更** | `app/layout.tsx` |
| **変更** | `components/lp/SnsSection.tsx` |
| **変更** | `components/lp/CastTabs.tsx` |
| **変更** | `app/store/[slug]/page.tsx` |
| **変更** | `app/cast/page.tsx` |
| **変更** | `app/cast/[id]/page.tsx` |
| **変更** | `app/ranking/page.tsx` |
| **変更** | `app/ranking/[slug]/page.tsx` |

---

## 2. 各ファイルの変更内容要約

- **lib/analytics.ts**  
  GA4 用の `window.gtag` 型定義、`getGAId` / `pageview` / `trackEvent`、および `trackMapClick` / `trackLineClick` / `trackTelClick` / `trackSnsClick` / `trackCastClick` を定義。`NEXT_PUBLIC_GA_ID` 未設定時は何もしない。

- **components/GoogleAnalytics.tsx**  
  `next/script` で gtag.js を読み込み、`send_page_view: false` で config。`usePathname` でクライアント遷移時に `pageview(path)` を送信。ID 未設定時は何も描画しない。

- **components/CastLink.tsx**  
  キャスト詳細への `Link` をラップし、クリック時に `trackCastClick(castName)` を実行。

- **components/MapLink.tsx**  
  地図URL用の `<a>` をラップし、クリック時に `trackMapClick(locationName)` を実行。

- **components/SnsLink.tsx**  
  SNS用の `<a>` をラップし、クリック時に `trackSnsClick(snsType, locationName)` を実行。

- **app/layout.tsx**  
  `<GoogleAnalytics />` を body 内に追加。

- **components/lp/SnsSection.tsx**  
  `"use client"` を追加。LINE リンクに `trackLineClick("公式")`、店舗別 X/Instagram/TikTok に `trackSnsClick(type, store.name)`、TikTok グループ公式に `trackSnsClick("tiktok", "星狼グループ公式")` を付与。

- **components/lp/CastTabs.tsx**  
  キャストカードの `Link` を `CastLink` に差し替え、`castName={cast.name}` を渡す。

- **app/store/[slug]/page.tsx**  
  iframe 下に「地図をGoogleマップで開く」用の `MapLink` を追加。在籍キャスト・ランキングのキャストリンクを `CastLink` に変更。

- **app/cast/page.tsx**  
  キャスト一覧の各リンクを `CastLink` に変更。

- **app/cast/[id]/page.tsx**  
  キャスト詳細の X/Instagram/TikTok リンクを `SnsLink` に変更（`locationName={cast.store.name}`）。

- **app/ranking/page.tsx**  
  ランキング一覧のキャストリンクを `CastLink` に変更。

- **app/ranking/[slug]/page.tsx**  
  店舗別ランキングのキャストリンクを `CastLink` に変更。

---

## 3. 実装コード（主要部分）

### lib/analytics.ts（抜粋）

- `getGAId()`: `process.env.NEXT_PUBLIC_GA_ID` を返す。
- `pageview(path, title?)`: `gtag('config', id, { page_path, page_title })` を実行。
- `trackEvent(name, params?)`: `gtag('event', name, params)` を実行。
- `trackMapClick(location_name)` → `click_map`
- `trackLineClick(location_name)` → `click_line`
- `trackTelClick(location_name)` → `click_tel`
- `trackSnsClick(sns_type, location_name)` → `click_sns`
- `trackCastClick(cast_name)` → `click_cast`

### GoogleAnalytics.tsx

- `NEXT_PUBLIC_GA_ID` が無い場合は null を返して何も描画しない。
- Script で `https://www.googletagmanager.com/gtag/js?id=${gaId}` と config（`send_page_view: false`）を読み込み。
- `usePathname()` の変更時に `pageview(pathname)` を実行。

---

## 4. .env.local に追加すべき内容

```env
# Google Analytics 4 測定ID（未設定の場合はGAは読み込まない）
NEXT_PUBLIC_GA_ID=G-B6LN2JP5N1
```

本番・ステージングで同じIDを使う場合は、それぞれの環境の `.env` に上記を追加してください。

---

## 5. 動作確認手順

1. **環境変数を設定**
   - プロジェクトルートの `.env.local` に `NEXT_PUBLIC_GA_ID=G-B6LN2JP5N1` を追加。

2. **開発サーバ起動**
   - `npm run dev` で起動し、ブラウザでサイトを表示。

3. **ページビュー**
   - トップ → 店舗詳細 → キャスト詳細など、複数ページを遷移する。
   - GA の「リアルタイム」で「ページビュー」が増えることを確認。

4. **カスタムイベント**
   - **click_map**: 店舗詳細で「地図をGoogleマップで開く」をクリック。
   - **click_line**: トップの SNS セクションで「公式LINE」をクリック。
   - **click_sns**: 店舗別 X/Instagram/TikTok、またはキャスト詳細の SNS をクリック。
   - **click_cast**: トップのキャストタブ、店舗詳細のキャスト、ランキングのキャスト名などをクリック。
   - 各操作後、GA の「リアルタイム」→「イベント」で対応するイベント名が表示されることを確認。

5. **ID 未設定時**
   - `.env.local` の `NEXT_PUBLIC_GA_ID` を削除またはコメントアウトし、再起動。
   - コンソールに gtag エラーが出ず、挙動が変わらないことを確認。

---

## 6. GA リアルタイム画面で確認すること

- **「リアルタイム」→「概要」**  
  現在のアクティブユーザー数と、直近のページビュー・イベント数。

- **「リアルタイム」→「イベント」**  
  - `page_view`: ページ表示・遷移。
  - `click_map`, `click_line`, `click_tel`, `click_sns`, `click_cast`: 各クリック。
  - イベントを選択すると、パラメータ（`location_name`, `sns_type`, `cast_name` など）を確認可能。

- **「リアルタイム」→「ページとスクリーン」**  
  どのURLで閲覧されているか。

- **「トラフィック獲得」**  
  流入元（検索・SNS・直接など）は、数時間〜1日程度経ってから「レポート」で見る方が正確です。リアルタイムでは「参照元」で大まかな流入を確認できます。

---

## 7. 電話クリック（click_tel）について

現状、サイト内に `tel:` リンクはありません。今後「電話で予約」などのリンクを設置する場合は、その `<a href="tel:...">` に `onClick={() => trackTelClick(店舗名など)}` を付与するか、`lib/analytics.ts` の `trackTelClick` を呼ぶラッパーコンポーネントを用意してください。

---

## 8. コンバージョン設定の提案

GA4 の「管理」→「コンバージョン」で、以下のイベントをコンバージョンとして登録することを推奨します。

| イベント名 | 用途 |
|------------|------|
| **click_line** | LINE 友だち追加・予約窓口への流入（最重要） |
| **click_tel** | 電話問い合わせ（tel リンク設置後） |
| **click_map** | 店舗への来店意欲（地図で場所を確認） |
| **click_cast** | キャストへの関心・詳細閲覧 |

`click_sns` は「SNS フォロー・拡散」の指標としてコンバージョンに含めてもよいですが、まずは **click_line** と **click_cast** をコンバージョンにすると、予約・キャスト人気の分析に役立ちます。

# concafe-app 運用ルール

## ⚠️ ブランチの正 — origin/main をデプロイしてはいけない

このリポジトリは concafe と VLiverLab が同居している。

| ブランチ | 中身 |
|---|---|
| `production` | **concafe 本体の正。本番で動いているのはこれ。GitHub のデフォルトブランチ** |
| `origin/main` | VLiverLab 系統（四目並べ入り）。`origin/archive/vliverlab` と同一コミット |
| `feature/cast-visibility` | `production` の起点（2026-07-20 時点） |

`origin/main` には給与計算・キャストランク・メニュー管理・リセット履歴が**存在しない**。
これをデプロイすると管理画面の機能が丸ごと消える。

## ⚠️ デプロイは開発機でビルドしてイメージを転送する（本番でビルドしない）

本番サーバーは利用可能メモリが ~470MB しかなく、Dockerfile が要求する 1536MB に届かない。
また本番サーバーにソースを置くと「古いソースをビルドして巻き戻る」事故が起きる（2026-07-24）。
このため本番の `/opt/apps/concafe-app/` にソースは**置かない**。`compose.yml` も `image:` 指定。

```bash
# 開発機で
docker build --build-arg NEXT_PUBLIC_GA_ID=G-B6LN2JP5N1 -t concafe-app-app:<tag> .
docker save concafe-app-app:<tag> | gzip -1 | ssh prod-server-deploy 'gunzip | docker load'
# 本番で compose.yml の image: タグを書き換えて
ssh prod-server-deploy 'cd /opt/apps/concafe-app && docker compose up -d'
```

`NEXT_PUBLIC_*` はビルド時にコードへ焼き込まれるため **build args で渡す**。`.env` では効かない。

## ⚠️ 本番の scripts/ は cron が参照している — 消さない

`ubuntu` の crontab が以下を直接叩いている。ディレクトリごと消すとバックアップが静かに止まる。

```
0 19 * * * /opt/apps/concafe-app/scripts/backup-db.sh   # 日次DBバックアップ
0 5 1 * * /opt/apps/concafe-app/scripts/monthly-reset.sh # 月次ポイントリセット
```

本番のファイルを整理するときは、**消す前に `crontab -l` で参照を確認する**
（2026-07-25、ソース整理でこの2つを消してしまい復元した）。
`monthly-reset.sh` は `/api/admin/monthly-reset` を叩くため、このAPIを含まないビルドを
デプロイすると月初に静かに失敗する。

## ⚠️ デプロイ前に必ず確認

1. **バックアップを取る**
   ```bash
   ssh prod-server-deploy '/opt/apps/concafe-app/scripts/backup-db.sh'
   ```

2. **Dockerボリューム名を確認する**
   ```bash
   ssh prod-server-deploy 'docker volume ls | grep concafe'
   ```
   → `concafe-app_app_data` が存在することを確認。`db-data` や `upload-data` が使われていたら異常。

3. **compose ファイルのボリューム設定を確認する**
   `compose.yml` の volumes は必ず以下の1行のみ：
   ```yaml
   - app_data:/data
   ```
   ボリューム名を変えるとデータが消えるため絶対に変更しない。

## ⚠️ `SalaryCastRecord.hpName` は `Cast.name` と別物 — 一括置換で巻き込まない

給与明細 `SalaryCastRecord` は、計算時点のキャスト名を `hpName` 列に**値のコピーとして**持つ。
確定した給与明細が後から変わってはいけないので、`Cast` への参照ではなく写しにしてある。
`Cast` 側の列名を変えても、こちらは変えない。

| 触るとき | 列名 |
|---|---|
| `Cast`（キャスト本体・HP・給与計算の入力） | `name` |
| `SalaryCastRecord`（確定した給与明細） | `hpName` ← 変えない |

**Prisma のネスト create は `XOR<>` 型のため、列名を間違えても `tsc --noEmit` が通る。**
実行して初めて `Unknown argument 'name'. Did you mean 'hpName'?` で落ちる。
給与まわりを触ったら必ず `npx vitest run tests/salary-save.test.ts` まで実行する。

（2026-08-14: `Cast.hpName` → `Cast.name` の統合リネームが `SalaryCastRecord.hpName` まで及び、
本番で給与計算の「計算実行」が常に500になった。保存チェックが既定ONで、クライアントの
`res.json()` も例外になるため画面にエラーすら出ず「ボタンが効かない」状態だった。
同時に管理画面だけ `hpName` のまま取り残され、名前欄が空・CSV取込で新規行が落ちる、も起きていた。
2026-08-16 に修正し、`tests/salary-save.test.ts` を回帰テストとして追加）

## 詳細ドキュメント

- **運用・インシデント対応・復旧手順**: `docs/OPERATIONS.md` を参照
  - デプロイ手順
  - バックアップ手順・自動バックアップの設定
  - DB復旧手順（バックアップからの戻し方）
  - 2026-07-10 インシデント記録と教訓

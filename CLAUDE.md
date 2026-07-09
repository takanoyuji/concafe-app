# concafe-app 運用ルール

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

## 詳細ドキュメント

- **運用・インシデント対応・復旧手順**: `docs/OPERATIONS.md` を参照
  - デプロイ手順
  - バックアップ手順・自動バックアップの設定
  - DB復旧手順（バックアップからの戻し方）
  - 2026-07-10 インシデント記録と教訓

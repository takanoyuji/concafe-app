# キャスト統合の切り戻し手順

適用日: 2026-08-14 / 対象: xing-lang.com（concafe-app）

## 重要

この変更は**データ移行を伴う**ため、イメージを戻すだけでは元に戻らない。
`Cast` と `CastMaster` が1つに統合され、`CastMaster` テーブルは削除されている。
**必ず DB のバックアップから復元する。**

## 切り戻しに使うもの

| | 場所 |
|---|---|
| 適用直前のDB | 本番 `/opt/apps/concafe-app/backups/concafe_20260814_161302.db` |
| 同上（手元の控え） | 開発機の作業用ディレクトリに退避済み |
| 統合前のイメージ | 本番 `concafe-app-app:cast-code-20260813` |
| 統合前のcompose | 本番 `/opt/apps/concafe-app/compose.yml.bak.*` |

適用直前のDBは Cast 29件 / CastMaster 35件 / PointLedger 2516件。

## 手順

```bash
ssh prod-server-deploy
cd /opt/apps/concafe-app

# 1. 止める
docker compose down

# 2. compose.yml のイメージを統合前に戻す
sed -i 's|^    image: concafe-app-app:.*|    image: concafe-app-app:cast-code-20260813|' compose.yml

# 3. DBを適用直前の状態に戻す
#    ボリュームの中身を直接置き換える（コンテナが止まっていることを確認してから）
docker run --rm -v concafe-app_app_data:/data -v /opt/apps/concafe-app/backups:/backup \
  alpine sh -c "cp /backup/concafe_20260814_161302.db /data/concafe.db"

# 4. 起動
docker compose up -d

# 5. 確認（Cast 29件 / CastMaster 35件 に戻っていること）
docker exec concafe-app-app-1 npx prisma migrate status
```

## 切り戻した場合の注意

- 統合後に登録された会計・ポイント・ユーザーは**失われる**（バックアップ時点に戻るため）
- remodri 側は `castCode` で紐づいているため、統合前のDBに戻しても同期は動く
  （`/api/sync/cast-master` は統合前後どちらの構造でも castCode を返す）

## 適用後に確認すること

1. HPの各店舗ページの掲載人数が 池袋11 / 日本橋9 / 名古屋栄5 であること
2. 管理画面のキャストタブに36名が出て、コード・所属店舗・退職が見えること
3. 給与計算が動くこと（`/admin` の給与計算タブ）
4. remodri のキャスト同期が35名を取得できること

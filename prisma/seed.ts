import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const url = process.env.DATABASE_URL ?? "file:./dev.db";
const adapter = new PrismaBetterSqlite3({ url });
const prisma = new PrismaClient({ adapter });

async function main() {
  // 初期ADMIN（環境変数で上書き可: ADMIN_EMAIL, ADMIN_PASSWORD）
  const adminEmail = process.env.ADMIN_EMAIL ?? "vliverlab@gmail.com";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "vllvll26!";
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash, role: "ADMIN", emailVerified: true, mustChangePassword: false },
    create: {
      email: adminEmail,
      passwordHash,
      role: "ADMIN",
      emailVerified: true,
      mustChangePassword: false,
    },
  });
  console.log(`✅ Admin user created/updated: ${adminEmail}`);

  // 2店舗
  const stores = [
    {
      slug: "osaka",
      name: "VLiverLab 梅田店",
      address: "〒530-0017 大阪府大阪市北区角田町",
      mapQuery: "大阪市北区角田町",
    },
    {
      slug: "tokyo",
      name: "VLiverLab 池袋店",
      address: "〒171-0014 東京都豊島区池袋３丁目５９−９ ＦＳビル 202",
      mapQuery: "東京都豊島区池袋3丁目59-9 FSビル 202",
    },
  ];

  for (const store of stores) {
    await prisma.store.upsert({
      where: { slug: store.slug },
      update: { name: store.name, address: store.address, mapQuery: store.mapQuery },
      create: store,
    });
  }
  console.log("✅ 2 stores created");

  // 称号マスタ（初回のみ）
  const existingTitles = await prisma.title.count();
  if (existingTitles === 0) {
    await prisma.title.createMany({
      data: [
        { name: "新参LABメンバー", threshold: 0,     order: 0 },
        { name: "データ収集者",    threshold: 100,   order: 1 },
        { name: "実験協力者",      threshold: 500,   order: 2 },
        { name: "上級研究員",      threshold: 1000,  order: 3 },
        { name: "LABの盟友",       threshold: 3000,  order: 4 },
        { name: "伝説のVライバー",  threshold: 10000, order: 5 },
      ],
    });
    console.log("✅ Default titles created");
  } else {
    console.log("⏭️  Titles already exist, skipping");
  }

  // メニュー初期データ（初回のみ）
  const existingMenuItems = await prisma.menuItem.count();
  if (existingMenuItems === 0) {
    await prisma.menuItem.createMany({
      data: [
        // ソフトドリンク
        ...[
          "ジンジャエール","ジャスミンティー","紅茶","緑茶","烏龍茶",
          "コーヒー","カフェオレ","オレンジジュース","グレープフルーツ",
          "パインジュース","ココア",
        ].map((name, i) => ({ category: "soft_drink", name, order: i })),
        // ノンアルカクテル
        ...[
          "いちごミルク","ストロベリーフィズ","シャーリーテンプル","レモンジンジャー",
          "ジンジャーミモザ","シンデレラ","フロリダ","ブルーソーダ",
        ].map((name, i) => ({ category: "nonalc_cocktail", name, order: i })),
        // フード
        { category: "food", name: "バニラアイス",                    price: "¥500",   note: null,           order: 0 },
        { category: "food", name: "たこ焼き",                        price: "¥800",   note: null,           order: 1 },
        { category: "food", name: "ポテト",                          price: "¥800",   note: null,           order: 2 },
        { category: "food", name: "生ハム",                          price: "¥1,000", note: null,           order: 3 },
        { category: "food", name: "落書きオムライス（チャーハン）",   price: "¥1,500", note: null,           order: 4 },
        { category: "food", name: "落書きオムライス（ボロネーゼ）",   price: "¥1,500", note: null,           order: 5 },
        { category: "food", name: "落書きオムライス（カルボナーラ）", price: "¥1,500", note: null,           order: 6 },
        { category: "food", name: "持ち込み料",                      price: "¥1,000", note: "匂いの弱いもの", order: 7 },
        // シャンパン
        { category: "champagne", name: "カフェパ",               price: "¥8,000",   badge: null,       order: 0 },
        { category: "champagne", name: "アスティ",               price: "¥9,000",   badge: null,       order: 1 },
        { category: "champagne", name: "MAVAM",                  price: "¥22,000",  badge: null,       order: 2 },
        { category: "champagne", name: "モエ（白）",             price: "¥30,000",  badge: null,       order: 3 },
        { category: "champagne", name: "モエ（NIR）",            price: "¥55,000",  badge: null,       order: 4 },
        { category: "champagne", name: "モエ（アイス）",         price: "¥70,000",  badge: null,       order: 5 },
        { category: "champagne", name: "ドンペリ",               price: "¥150,000", badge: null,       order: 6 },
        { category: "champagne", name: "エンジェル",             price: "¥198,000", badge: null,       order: 7 },
        { category: "champagne", name: "アルマンド（ゴールド）", price: "¥200,000", badge: null,       order: 8 },
        { category: "champagne", name: "オリジナルシャンパン",   price: "¥12,000",  badge: "original", order: 9 },
        // キャストメニュー
        { category: "cast_drink", name: "キャスト用ドリンク", price: "¥1,100", badge: null,         order: 0 },
        { category: "cast_drink", name: "オリジナルカクテル", price: "¥1,500", badge: "チェキつき", order: 1 },
      ],
    });
    console.log("✅ Menu items created");
  } else {
    console.log("⏭️  Menu items already exist, skipping");
  }

  console.log("\n🌟 Seed completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

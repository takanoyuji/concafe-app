import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const url = process.env.DATABASE_URL ?? "file:./dev.db";
const adapter = new PrismaBetterSqlite3({ url });
const prisma = new PrismaClient({ adapter });

async function main() {
  // 初期ADMIN（環境変数で上書き可: ADMIN_EMAIL, ADMIN_PASSWORD）
  const adminEmail = process.env.ADMIN_EMAIL ?? "xinglang22@gmail.com";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "xxx123";
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: "ADMIN", emailVerified: true },
    create: {
      email: adminEmail,
      passwordHash,
      role: "ADMIN",
      emailVerified: true,
      mustChangePassword: true,
    },
  });
  console.log(`✅ Admin user created/updated: ${adminEmail}`);

  // 3店舗
  const stores = [
    {
      slug: "tokyo",
      name: "星狼 池袋店",
      address: "〒171-0014 東京都豊島区池袋３丁目５９−９ ＦＳビル 202",
      mapQuery: "東京都豊島区池袋3丁目59-9 FSビル 202",
    },
    {
      slug: "osaka",
      name: "星狼 日本橋店",
      address: "〒556-0005 大阪府大阪市浪速区日本橋３丁目１−１８ 菊乃好 5F",
      mapQuery: "大阪府大阪市浪速区日本橋3丁目1-18 菊乃好 5F",
    },
    {
      slug: "nagoya",
      name: "星狼 名古屋錦店",
      address: "〒460-0003 愛知県名古屋市中区錦３丁目１９−２４ サンステンドビル 4F-A",
      mapQuery: "愛知県名古屋市中区錦3丁目19-24 サンステンドビル",
    },
  ];

  for (const store of stores) {
    await prisma.store.upsert({
      where: { slug: store.slug },
      update: {},
      create: store,
    });
  }
  console.log("✅ 3 stores created");

  // 称号マスタ（初回のみ）
  const existingTitles = await prisma.title.count();
  if (existingTitles === 0) {
    await prisma.title.createMany({
      data: [
        { name: "新参の星見", threshold: 0,     order: 0 },
        { name: "月の使徒",   threshold: 100,   order: 1 },
        { name: "星の守護者", threshold: 500,   order: 2 },
        { name: "銀狼の友",   threshold: 1000,  order: 3 },
        { name: "星狼の盟友", threshold: 3000,  order: 4 },
        { name: "伝説の星獣", threshold: 10000, order: 5 },
      ],
    });
    console.log("✅ Default titles created");
  } else {
    console.log("⏭️  Titles already exist, skipping");
  }

  console.log("\n🌟 Seed completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

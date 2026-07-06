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
    update: { role: "ADMIN", emailVerified: true },  // パスワードは初回作成時のみ設定（デプロイのたびにリセットしない）
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
      name: "星狼 名古屋栄店",
      address: "〒460-0003 愛知県名古屋市中区錦３丁目１９−２４ サンステンドビル 4F-A",
      mapQuery: "愛知県名古屋市中区錦3丁目19-24 サンステンドビル",
    },
  ];

  for (const store of stores) {
    await prisma.store.upsert({
      where: { slug: store.slug },
      update: { name: store.name, address: store.address, mapQuery: store.mapQuery },
      create: store,
    });
  }
  console.log("✅ 3 stores created");

  // キャストデータ（初回のみ）
  const existingCasts = await prisma.cast.count();
  if (existingCasts === 0) {
    const tokyoStore  = await prisma.store.findUnique({ where: { slug: "tokyo" } });
    const osakaStore  = await prisma.store.findUnique({ where: { slug: "osaka" } });
    const nagoyaStore = await prisma.store.findUnique({ where: { slug: "nagoya" } });

    if (tokyoStore && osakaStore && nagoyaStore) {
      const PLACEHOLDER = "/images/cast-coming-soon.svg";

      const tokyoCasts = [
        { name: "透",               bio: "",              twitterUrl: null,                                  instagramUrl: null,                                          tiktokUrl: null,                                       order: 1 },
        { name: "暗本コウキ",       bio: "東京店/副店長", twitterUrl: "https://x.com/kuramoto730",           instagramUrl: "https://www.instagram.com/kuramoto.kouki",   tiktokUrl: "https://www.tiktok.com/@ko_ki.kuramoto",   order: 2 },
        { name: "みおと",           bio: "",              twitterUrl: "https://x.com/mioto1231_cafe",        instagramUrl: "https://www.instagram.com/mioto1231_cafe",    tiktokUrl: "https://www.tiktok.com/@mioto1231_cafe",   order: 3 },
        { name: "ARIA",             bio: "",              twitterUrl: "https://x.com/xinglang_aria",         instagramUrl: "https://www.instagram.com/xinglang_aria",     tiktokUrl: "https://www.tiktok.com/@aria0120",         order: 4 },
        { name: "すかいぶるぅ",     bio: "",              twitterUrl: "https://x.com/skyblue__511",          instagramUrl: "https://www.instagram.com/skyblue.xinglang",  tiktokUrl: "https://www.tiktok.com/@skyblue0511",      order: 5 },
        { name: "鈴白るゅん",       bio: "",              twitterUrl: "https://x.com/ryun_cos_25chan",       instagramUrl: "https://www.instagram.com/ryun_252525",       tiktokUrl: "https://www.tiktok.com/@rau_02_cos",       order: 6 },
        { name: "びすこ",           bio: "",              twitterUrl: "https://x.com/bisuko_snrn",           instagramUrl: "https://www.instagram.com/bisuko_cafe",       tiktokUrl: "https://www.tiktok.com/@dokokaniiruy0",    order: 7 },
        { name: "タマガワじょんそん", bio: "",             twitterUrl: "https://x.com/tama_syaketoba",        instagramUrl: "https://www.instagram.com/tamagawa_1014",     tiktokUrl: "https://www.tiktok.com/@tamagawa_syaketoba", order: 8 },
        { name: "りゅう",           bio: "",              twitterUrl: null,                                  instagramUrl: "https://www.instagram.com/ryu_xinglang",      tiktokUrl: null,                                       order: 9 },
        { name: "ほのか",           bio: "",              twitterUrl: "https://x.com/honokaxinglang",        instagramUrl: "https://www.instagram.com/honokaxinglang",    tiktokUrl: "https://www.tiktok.com/@honoka.night.over", order: 10 },
        { name: "ミラコッタ",       bio: "",              twitterUrl: "https://x.com/milacotta213",          instagramUrl: "https://www.instagram.com/xi.aolin3653",      tiktokUrl: "https://www.tiktok.com/@mition22111333",   order: 11 },
        { name: "Tag値",            bio: "",              twitterUrl: "https://x.com/taguchi_rkrn_c",        instagramUrl: "https://www.instagram.com/taguti_t4",         tiktokUrl: "https://www.tiktok.com/@pino5pino",        order: 12 },
      ];

      const osakaCasts = [
        { name: "かおる",   bio: "大阪店/店長",   twitterUrl: "https://x.com/kaoru_30197",       instagramUrl: "https://www.instagram.com/kaoru_xinglang",        tiktokUrl: "https://www.tiktok.com/@kaoru_xinglang",    order: 1 },
        { name: "きょーあ", bio: "大阪店/副店長", twitterUrl: "https://x.com/kyoooa_Cos",        instagramUrl: "https://www.instagram.com/honey_kyo_xinglang",    tiktokUrl: "https://www.tiktok.com/@honey_xxkun",       order: 2 },
        { name: "りくは",   bio: "",              twitterUrl: "https://x.com/Rikkun_cos",        instagramUrl: "https://www.instagram.com/rikkun_cos",            tiktokUrl: "https://www.tiktok.com/@rikkun_cos52",      order: 3 },
        { name: "杏餅",     bio: "",              twitterUrl: "https://x.com/anzumochi1020",     instagramUrl: "https://www.instagram.com/anzumothi1020",         tiktokUrl: "https://www.tiktok.com/@anzumoti1020",      order: 4 },
        { name: "なぎりょ", bio: "",              twitterUrl: "https://x.com/nagiryo_snrn",      instagramUrl: "https://www.instagram.com/nagiryo_xinglang",      tiktokUrl: "https://www.tiktok.com/@nagi_21chan",        order: 5 },
        { name: "にと",     bio: "",              twitterUrl: "https://x.com/nito_nito_01",      instagramUrl: "https://www.instagram.com/nito_nito_0124",        tiktokUrl: "https://www.tiktok.com/@nito_nito_01",      order: 6 },
        { name: "近藤",     bio: "TIKTOK総括",   twitterUrl: "https://x.com/musically_KoNDo",   instagramUrl: "https://www.instagram.com/kondo_musicl.ly",       tiktokUrl: "https://www.tiktok.com/@takaha_xinglang",   order: 7 },
        { name: "夜仲",     bio: "",              twitterUrl: "https://x.com/yonakaa00",         instagramUrl: "https://www.instagram.com/yonaka_xinglang",       tiktokUrl: "https://www.tiktok.com/@yonana000",         order: 8 },
        { name: "峰村ミネ", bio: "広報",          twitterUrl: "https://x.com/mine_xinglang",     instagramUrl: "https://www.instagram.com/mnmr__p",               tiktokUrl: "https://www.tiktok.com/@yude_8080",         order: 9 },
      ];

      const nagoyaCasts = [
        { name: "ほむら", bio: "大阪店/店長", twitterUrl: null,                                  instagramUrl: "https://www.instagram.com/homura_xinglang",   tiktokUrl: "https://www.tiktok.com/@homuhomu.ra", order: 1 },
        { name: "佐吉",   bio: "",            twitterUrl: null,                                  instagramUrl: "https://www.instagram.com/sakichi_xinglang",  tiktokUrl: "https://www.tiktok.com/@sakichiookm", order: 2 },
        { name: "あまね", bio: "",            twitterUrl: null,                                  instagramUrl: "https://www.instagram.com/amane_xinglang",    tiktokUrl: "https://www.tiktok.com/@_amane_11",   order: 3 },
      ];

      await prisma.cast.createMany({
        data: [
          ...tokyoCasts.map(c  => ({ ...c, imageUrl: PLACEHOLDER, storeId: tokyoStore.id })),
          ...osakaCasts.map(c  => ({ ...c, imageUrl: PLACEHOLDER, storeId: osakaStore.id })),
          ...nagoyaCasts.map(c => ({ ...c, imageUrl: PLACEHOLDER, storeId: nagoyaStore.id })),
        ],
      });
      console.log(`✅ ${tokyoCasts.length + osakaCasts.length + nagoyaCasts.length} casts created`);
    } else {
      console.warn("⚠️  Stores not found, skipping cast seed");
    }
  } else {
    console.log(`⏭️  Casts already exist (${existingCasts}), skipping`);
  }

  // メニュー画像（初回のみ）
  const existingMenuItems = await prisma.menuItem.count();
  if (existingMenuItems === 0) {
    await prisma.menuItem.createMany({
      data: [
        { imageUrl: "/images/menu/system.jpg",           alt: "システム・料金案内",   order: 1 },
        { imageUrl: "/images/menu/xinglang_menu00.webp", alt: "星狼メニュー表紙",     order: 2 },
        { imageUrl: "/images/menu/xinglang_menu01.webp", alt: "星狼メニュー 1ページ", order: 3 },
        { imageUrl: "/images/menu/xinglang_menu02.webp", alt: "星狼メニュー 2ページ", order: 4 },
        { imageUrl: "/images/menu/xinglang_menu03.webp", alt: "星狼メニュー 3ページ", order: 5 },
        { imageUrl: "/images/menu/xinglang_menu04.webp", alt: "星狼メニュー 4ページ", order: 6 },
        { imageUrl: "/images/menu/menu1.jpg",            alt: "フードメニュー 1",     order: 7 },
        { imageUrl: "/images/menu/menu2.jpg",            alt: "フードメニュー 2",     order: 8 },
        { imageUrl: "/images/menu/menu3.jpg",            alt: "フードメニュー 3",     order: 9 },
        { imageUrl: "/images/menu/menu4.jpg",            alt: "フードメニュー 4",     order: 10 },
        { imageUrl: "/images/menu/S__95674396.jpg",      alt: "限定メニュー",         order: 11 },
      ],
    });
    console.log("✅ 11 menu items created");
  } else {
    console.log(`⏭️  Menu items already exist (${existingMenuItems}), skipping`);
  }

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

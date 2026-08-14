import { prisma } from "@/lib/prisma";
import { PUBLIC_CAST_WHERE } from "@/lib/cast";
import CastTabs from "./CastTabs";

export default async function CastSection() {
  const rows = await prisma.cast.findMany({
    where: PUBLIC_CAST_WHERE,
    // 給与情報（airShiftName / rank / exemptFromCommuteRule）は公開しない
    select: {
      id: true, name: true, bio: true, imageUrl: true, order: true,
      twitterUrl: true, instagramUrl: true, tiktokUrl: true,
      stores: {
        select: { isPrimary: true, store: { select: { id: true, name: true, slug: true } } },
        orderBy: { isPrimary: "desc" },
      },
    },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });

  // 掛け持ちしていても、出るのは主たる店舗のタブだけ
  const casts = rows.map(({ stores, ...cast }) => {
    const primary = stores.find(s => s.isPrimary)?.store ?? stores[0]?.store;
    return {
      ...cast,
      store: primary ?? { name: "", slug: "" },
      storeSlugs: primary ? [primary.slug] : [],
    };
  });

  const stores = [
    { slug: "tokyo",  name: "池袋店" },
    { slug: "osaka",  name: "日本橋店" },
    { slug: "nagoya", name: "名古屋栄店" },
  ];

  return (
    <section id="sec02" className="py-20 px-4" style={{ background: "#06040f" }}>
      <h2 className="section-title gradient-text">CAST</h2>
      <div data-reveal>
        <CastTabs casts={casts} stores={stores} />
      </div>
    </section>
  );
}

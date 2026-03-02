import { prisma } from "@/lib/prisma";
import CastTabs from "./CastTabs";

export default async function CastSection() {
  const casts = await prisma.cast.findMany({
    include: { store: { select: { id: true, name: true, slug: true } } },
    orderBy: [{ storeId: "asc" }, { order: "asc" }],
  });

  const stores = [
    { slug: "tokyo",  name: "池袋店" },
    { slug: "osaka",  name: "日本橋店" },
    { slug: "nagoya", name: "名古屋錦店" },
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

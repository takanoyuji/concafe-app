import { prisma } from "@/lib/prisma";
import CastTabs from "./CastTabs";

export default async function CastSection() {
  const casts = await prisma.cast.findMany({
    orderBy: { order: "asc" },
  });

  return (
    <section id="sec02" className="py-20 px-4" style={{ background: "#07060e" }}>
      <div className="holo-divider" />
      <h2 className="section-title holo-text pt-12">CAST</h2>
      <div data-reveal>
        <CastTabs casts={casts} />
      </div>
    </section>
  );
}

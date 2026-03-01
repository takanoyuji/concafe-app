import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function CastSection() {
  const casts = await prisma.cast.findMany({
    include: { store: { select: { name: true, slug: true } } },
    orderBy: { order: "asc" },
    take: 6,
  });

  return (
    <section id="sec02" className="py-20 px-4" style={{ background: "#06040f" }}>
      <h2 className="section-title gradient-text">CAST</h2>

      {casts.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {casts.map((cast) => (
            <Link
              key={cast.id}
              href={`/cast/${cast.id}`}
              className="glass group hover:border-neon-violet transition-all duration-300 hover:scale-[1.02] p-4 text-center block"
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-neon-violet to-neon-purple mx-auto mb-3 flex items-center justify-center text-2xl">
                🐺
              </div>
              <div className="font-bold text-white group-hover:text-neon-purple transition-colors">
                {cast.name}
              </div>
              <div className="text-xs text-white/50 mt-1">{cast.store.name}</div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="glass max-w-md mx-auto p-8 text-center text-white/50">
          <p>キャスト情報は近日公開予定です</p>
        </div>
      )}

      <div className="text-center mt-10">
        <Link href="/cast" className="btn-secondary inline-block">
          キャスト一覧を見る →
        </Link>
      </div>
    </section>
  );
}

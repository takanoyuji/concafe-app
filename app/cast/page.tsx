import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import NavBar from "@/components/ui/NavBar";
import CastClickLink from "@/components/analytics/CastClickLink";

export const dynamic = "force-dynamic";

export default async function CastListPage() {
  const casts = await prisma.cast.findMany({ orderBy: { order: "asc" } });

  return (
    <>
      <NavBar />
      <main className="min-h-screen pt-24 pb-16 px-4 max-w-5xl mx-auto">
        <h1 className="text-3xl font-black gradient-text text-neon-glow text-center mb-10">
          CAST
        </h1>

        {casts.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {casts.map((cast) => (
              <CastClickLink
                key={cast.id}
                href={`/cast/${cast.id}`}
                castName={cast.name}
                className="glass group hover:border-neon-violet transition-all duration-300 hover:scale-[1.03] overflow-hidden block"
              >
                <div className="relative aspect-[3/4] bg-gradient-to-br from-neon-violet to-neon-purple">
                  {cast.imageUrl && (
                    <Image
                      src={cast.imageUrl}
                      alt={cast.name}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      className="object-cover"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <div className="font-bold text-white text-sm group-hover:text-neon-purple transition-colors leading-tight">
                      {cast.name}
                    </div>
                    <div className="text-xs text-white/50 mt-0.5 line-clamp-2">{cast.bio}</div>
                  </div>
                </div>
              </CastClickLink>
            ))}
          </div>
        ) : (
          <div className="glass p-6 text-white/50 text-center rounded-xl">
            キャスト情報は近日公開予定です
          </div>
        )}

        <div className="text-center mt-8">
          <Link href="/" className="btn-secondary inline-block">← トップページ</Link>
        </div>
      </main>
    </>
  );
}

import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import NavBar from "@/components/ui/NavBar";
import CastLink from "@/components/CastLink";

export const dynamic = "force-dynamic";

export default async function CastListPage() {
  const stores = await prisma.store.findMany({
    include: { casts: { orderBy: { order: "asc" } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <>
      <NavBar />
      <main className="min-h-screen pt-24 pb-16 px-4 max-w-5xl mx-auto">
        <h1 className="text-3xl font-black gradient-text text-neon-glow text-center mb-10">
          CAST
        </h1>

        {stores.map((store) => (
          <section key={store.id} className="mb-12">
            <h2 className="text-xl font-bold text-star-300 text-star-glow mb-4 flex items-center gap-2">
              <Link href={`/store/${store.slug}`} className="hover:text-neon-purple transition-colors">
                {store.name}
              </Link>
            </h2>
            {store.casts.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {store.casts.map((cast) => (
                  <CastLink
                    key={cast.id}
                    href={`/cast/${cast.id}`}
                    castName={cast.name}
                    className="glass group hover:border-neon-violet transition-all duration-300 hover:scale-[1.03] p-4 text-center"
                  >
                    <div className="w-16 h-16 rounded-full overflow-hidden mx-auto mb-3 bg-gradient-to-br from-neon-violet to-neon-purple flex items-center justify-center relative">
                      {cast.imageUrl ? (
                        <Image
                          src={cast.imageUrl}
                          alt={cast.name}
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      ) : (
                        <span className="text-2xl">🐺</span>
                      )}
                    </div>
                    <div className="font-bold text-white text-sm group-hover:text-neon-purple transition-colors">
                      {cast.name}
                    </div>
                    <div className="text-xs text-white/40 mt-1 line-clamp-2">{cast.bio}</div>
                  </CastLink>
                ))}
              </div>
            ) : (
              <div className="glass p-6 text-white/50 text-center rounded-xl">
                キャスト情報は近日公開予定です
              </div>
            )}
          </section>
        ))}

        <div className="text-center mt-8">
          <Link href="/" className="btn-secondary inline-block">← トップページ</Link>
        </div>
      </main>
    </>
  );
}

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import NavBar from "@/components/ui/NavBar";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CastDetailPage({ params }: Props) {
  const { id } = await params;
  const cast = await prisma.cast.findUnique({
    where: { id },
    include: { store: true },
  });

  if (!cast) notFound();

  return (
    <>
      <NavBar />
      <main className="min-h-screen pt-24 pb-16 px-4 max-w-2xl mx-auto">
        <div className="glass p-8 text-center space-y-4">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-neon-violet to-neon-purple mx-auto flex items-center justify-center text-4xl neon-glow-purple">
            🐺
          </div>
          <h1 className="text-3xl font-black text-white text-neon-glow">
            {cast.name}
          </h1>
          <div className="inline-block glass-dark px-4 py-1 rounded-full text-sm text-white/70">
            <Link href={`/store/${cast.store.slug}`} className="hover:text-neon-purple transition-colors">
              {cast.store.name}
            </Link>
          </div>
          <p className="text-white/70 leading-relaxed text-base whitespace-pre-wrap">
            {cast.bio}
          </p>
        </div>

        <div className="text-center mt-8 space-x-4">
          <Link href="/cast" className="btn-secondary inline-block">
            ← キャスト一覧
          </Link>
          <Link href="/gift" className="btn-primary inline-block">
            プレゼントする 🎁
          </Link>
        </div>
      </main>
    </>
  );
}

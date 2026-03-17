import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import NavBar from "@/components/ui/NavBar";
import SnsLink from "@/components/SnsLink";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const cast = await prisma.cast.findUnique({
    where: { id },
    include: { store: { select: { name: true } } },
  });
  if (!cast) return {};
  return {
    title: cast.name,
    description: `${cast.store.name}所属キャスト「${cast.name}」。${cast.bio.slice(0, 80)}`,
  };
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
        <div className="glass p-8 space-y-6">
          {/* キャスト画像 */}
          <div className="relative w-48 h-64 mx-auto rounded-2xl overflow-hidden neon-glow-purple bg-gradient-to-br from-neon-violet to-neon-purple flex items-center justify-center">
            {cast.imageUrl ? (
              <Image
                src={cast.imageUrl}
                alt={cast.name}
                fill
                sizes="192px"
                className="object-cover"
                priority
              />
            ) : (
              <span className="text-7xl">🐺</span>
            )}
          </div>

          <div className="text-center space-y-3">
            <h1 className="text-3xl font-black text-white text-neon-glow">
              {cast.name}
            </h1>
            <div className="inline-block glass-dark px-4 py-1 rounded-full text-sm text-white/70">
              <Link href={`/store/${cast.store.slug}`} className="hover:text-neon-purple transition-colors">
                {cast.store.name}
              </Link>
            </div>

            {/* SNSリンク */}
            {(cast.twitterUrl || cast.instagramUrl || cast.tiktokUrl) && (
              <div className="flex gap-2 justify-center flex-wrap pt-1">
                {cast.twitterUrl && (
                  <SnsLink
                    href={cast.twitterUrl}
                    snsType="x"
                    locationName={cast.store.name}
                    className="glass-dark px-3 py-1.5 rounded-full text-xs text-white/70 hover:text-white hover:border-neon-violet transition-all"
                  >
                    𝕏 / Twitter
                  </SnsLink>
                )}
                {cast.instagramUrl && (
                  <SnsLink
                    href={cast.instagramUrl}
                    snsType="instagram"
                    locationName={cast.store.name}
                    className="glass-dark px-3 py-1.5 rounded-full text-xs text-white/70 hover:text-white hover:border-neon-violet transition-all"
                  >
                    Instagram
                  </SnsLink>
                )}
                {cast.tiktokUrl && (
                  <SnsLink
                    href={cast.tiktokUrl}
                    snsType="tiktok"
                    locationName={cast.store.name}
                    className="glass-dark px-3 py-1.5 rounded-full text-xs text-white/70 hover:text-white hover:border-neon-violet transition-all"
                  >
                    TikTok
                  </SnsLink>
                )}
              </div>
            )}

            <p className="text-white/70 leading-relaxed text-base whitespace-pre-wrap pt-2">
              {cast.bio}
            </p>
          </div>
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

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import NavBar from "@/components/ui/NavBar";
import CastDetailSnsLinks from "@/components/analytics/CastDetailSnsLinks";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const cast = await prisma.cast.findUnique({ where: { id } });
  if (!cast) return {};
  return {
    title: cast.name,
    description: `VLiverLabキャスト「${cast.name}」。${cast.bio.slice(0, 80)}`,
  };
}

export default async function CastDetailPage({ params }: Props) {
  const { id } = await params;
  const cast = await prisma.cast.findUnique({ where: { id } });

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
            {/* SNSリンク */}
            <CastDetailSnsLinks
              castName={cast.name}
              twitterUrl={cast.twitterUrl}
              youtubeUrl={cast.youtubeUrl}
              streamUrl={cast.streamUrl}
            />

            <p className="text-white/70 leading-relaxed text-base whitespace-pre-wrap pt-2">
              {cast.bio}
            </p>
          </div>
        </div>

        <div className="text-center mt-8 space-x-4">
          <Link href="/cast" className="btn-secondary inline-block">
            ← キャスト一覧
          </Link>
          <Link href={`/gift/${cast.id}`} className="btn-primary inline-block">
            プレゼントする 🎁
          </Link>
        </div>
      </main>
    </>
  );
}

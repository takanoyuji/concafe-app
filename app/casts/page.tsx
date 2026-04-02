import { prisma } from "@/lib/prisma";
import NavBar from "@/components/ui/NavBar";
import CastTabs from "@/components/lp/CastTabs";
import Footer from "@/components/ui/Footer";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CastsPage() {
  const casts = await prisma.cast.findMany({ orderBy: { order: "asc" } });

  return (
    <>
      <NavBar />
      <main className="min-h-screen pt-24 pb-16" style={{ background: "#07060e" }}>
        <div className="px-4">
          <div className="holo-divider" />
          <h1 className="section-title holo-text pt-12 text-center">CAST</h1>
        </div>
        <div className="px-4">
          <CastTabs casts={casts} />
        </div>
        <div className="text-center mt-10 px-4">
          <Link href="/" className="btn-secondary inline-block">← トップページ</Link>
        </div>
      </main>
      <Footer />
    </>
  );
}

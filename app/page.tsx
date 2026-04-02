import NavBar from "@/components/ui/NavBar";
import HeroSection from "@/components/lp/HeroSection";
import ConceptSection from "@/components/lp/ConceptSection";
import CastSection from "@/components/lp/CastSection";
import SystemSection from "@/components/lp/SystemSection";
import MenuSection from "@/components/lp/MenuSection";
import CalendarSection from "@/components/lp/CalendarSection";
import AccessSection from "@/components/lp/AccessSection";
import SnsSection from "@/components/lp/SnsSection";
import RulesSection from "@/components/lp/RulesSection";
import RecruitSection from "@/components/lp/RecruitSection";
import Footer from "@/components/ui/Footer";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const rawItems = await prisma.menuItem.findMany({
    orderBy: [{ category: "asc" }, { order: "asc" }],
  });
  // Date型はクライアントコンポーネントに渡せないのでシリアライズ
  const menuItems = rawItems.map(({ id, category, name, price, note, badge, order }) => ({
    id, category, name, price, note, badge, order,
  }));

  return (
    <>
      <NavBar />
      <main>
        <HeroSection />
        <ConceptSection />
        <CastSection />
        <SystemSection />
        <MenuSection initialItems={menuItems} />
        <CalendarSection />
        <AccessSection />
        <SnsSection />
        <RulesSection />
        <RecruitSection />
      </main>
      <Footer />
    </>
  );
}

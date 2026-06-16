import NavBar from "@/components/ui/NavBar";
import HeroSection from "@/components/lp/HeroSection";
import ConceptSection from "@/components/lp/ConceptSection";
import AtmosphereSection from "@/components/lp/AtmosphereSection";
import CastSection from "@/components/lp/CastSection";
import SystemSection from "@/components/lp/SystemSection";
import MenuSection from "@/components/lp/MenuSection";
import CalendarSection from "@/components/lp/CalendarSection";
import AccessSection from "@/components/lp/AccessSection";
import SnsSection from "@/components/lp/SnsSection";
import RulesSection from "@/components/lp/RulesSection";
import RecruitSection from "@/components/lp/RecruitSection";
import MiniGameSection from "@/components/lp/MiniGameSection";
import Footer from "@/components/ui/Footer";
import { prisma } from "@/lib/prisma";
import { getMonthlyRanking } from "@/lib/points";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const now = new Date();
  // 前月を計算（1月の場合は前年12月）
  const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth(); // 1-indexed

  const [rawItems, prevMonthRanking] = await Promise.all([
    prisma.menuItem.findMany({
      orderBy: [{ category: "asc" }, { order: "asc" }],
    }),
    getMonthlyRanking(prevYear, prevMonth),
  ]);

  // Date型はクライアントコンポーネントに渡せないのでシリアライズ
  const menuItems = rawItems.map(({ id, category, name, price, note, badge, order }) => ({
    id, category, name, price, note, badge, order,
  }));

  const topCast = prevMonthRanking[0]?.totalPoints > 0 ? prevMonthRanking[0] : null;
  const topCastMonth = `${prevYear}年${prevMonth}月`;

  return (
    <>
      <NavBar />
      <main>
        <HeroSection topCast={topCast} topCastMonth={topCastMonth} />
        <ConceptSection />
        <AtmosphereSection />
        <CastSection />
        <SystemSection />
        <MenuSection initialItems={menuItems} />
        <CalendarSection />
        <AccessSection />
        <SnsSection />
        <RulesSection />
        <RecruitSection />
        <MiniGameSection />
      </main>
      <Footer />
    </>
  );
}

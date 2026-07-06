import NavBar from "@/components/ui/NavBar";
import HeroSection from "@/components/lp/HeroSection";
import ConceptSection from "@/components/lp/ConceptSection";
import CastSection from "@/components/lp/CastSection";
import MenuSection from "@/components/lp/MenuSection";
import CalendarSection from "@/components/lp/CalendarSection";
import AccessSection from "@/components/lp/AccessSection";
import SnsSection from "@/components/lp/SnsSection";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const menuItems = await prisma.menuItem.findMany({ orderBy: { order: "asc" } });

  return (
    <>
      <NavBar />
      <main>
        <HeroSection />
        <ConceptSection />
        <CastSection />
        <MenuSection items={menuItems} />
        <CalendarSection />
        <AccessSection />
        <SnsSection />
      </main>
    </>
  );
}

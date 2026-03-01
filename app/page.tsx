import NavBar from "@/components/ui/NavBar";
import HeroSection from "@/components/lp/HeroSection";
import ConceptSection from "@/components/lp/ConceptSection";
import CastSection from "@/components/lp/CastSection";
import MenuSection from "@/components/lp/MenuSection";
import CalendarSection from "@/components/lp/CalendarSection";
import AccessSection from "@/components/lp/AccessSection";
import SnsSection from "@/components/lp/SnsSection";

export default function HomePage() {
  return (
    <>
      <NavBar />
      <main>
        <HeroSection />
        <ConceptSection />
        <CastSection />
        <MenuSection />
        <CalendarSection />
        <AccessSection />
        <SnsSection />
      </main>
    </>
  );
}

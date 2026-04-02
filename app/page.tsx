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

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <>
      <NavBar />
      <main>
        <HeroSection />
        <ConceptSection />
        <CastSection />
        <SystemSection />
        <MenuSection />
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

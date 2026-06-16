import type { Metadata } from "next";
import NavBar from "@/components/ui/NavBar";
import Footer from "@/components/ui/Footer";
import YonmokuApp from "@/components/yonmoku/YonmokuApp";

export const metadata: Metadata = {
  title: "4目並べ",
  description:
    "シンプルだけど意外と奥深い、定番の2人対戦ミニゲーム。ローカル2人対戦はもちろん、ルームを作れば離れた場所の人ともオンライン対戦できます。",
};

/** /yonmoku — 4目並べページ */
export default function YonmokuPage() {
  return (
    <>
      <NavBar />
      <main>
        <YonmokuApp />
      </main>
      <Footer />
    </>
  );
}

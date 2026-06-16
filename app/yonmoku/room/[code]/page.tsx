import type { Metadata } from "next";
import NavBar from "@/components/ui/NavBar";
import Footer from "@/components/ui/Footer";
import OnlineGame from "@/components/yonmoku/OnlineGame";

interface Props {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  return {
    title: `4目並べ - ルーム ${code.toUpperCase()}`,
    description: `オンライン4目並べ。ルームコード: ${code.toUpperCase()}`,
  };
}

/** /yonmoku/room/[code] — オンライン対戦ルームページ */
export default async function RoomPage({ params }: Props) {
  const { code } = await params;
  return (
    <>
      <NavBar />
      <main>
        <OnlineGame roomCode={code.toUpperCase()} />
      </main>
      <Footer />
    </>
  );
}

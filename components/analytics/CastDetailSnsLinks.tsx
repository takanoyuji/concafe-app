"use client";

import { clickSns } from "@/lib/analytics";

type Props = {
  castName: string;
  twitterUrl?: string | null;
  youtubeUrl?: string | null;
  streamUrl?: string | null;
};

/** キャスト詳細のSNSリンク。クリック時に click_sns を送信 */
export default function CastDetailSnsLinks({
  castName,
  twitterUrl,
  youtubeUrl,
  streamUrl,
}: Props) {
  if (!twitterUrl && !youtubeUrl && !streamUrl) return null;

  const locationName = `cast:${castName}`;

  return (
    <div className="flex gap-2 justify-center flex-wrap pt-1">
      {twitterUrl && (
        <a
          href={twitterUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="glass-dark px-3 py-1.5 rounded-full text-xs text-white/70 hover:text-white hover:border-neon-violet transition-all"
          onClick={() => clickSns("x", locationName)}
        >
          𝕏 / Twitter
        </a>
      )}
      {youtubeUrl && (
        <a
          href={youtubeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="glass-dark px-3 py-1.5 rounded-full text-xs text-white/70 hover:text-white hover:border-neon-violet transition-all"
          onClick={() => clickSns("youtube", locationName)}
        >
          YouTube
        </a>
      )}
      {streamUrl && (
        <a
          href={streamUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="glass-dark px-3 py-1.5 rounded-full text-xs text-white/70 hover:text-white hover:border-neon-violet transition-all"
          onClick={() => clickSns("stream", locationName)}
        >
          配信
        </a>
      )}
    </div>
  );
}

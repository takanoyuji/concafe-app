"use client";

import Link from "next/link";
import { clickCast } from "@/lib/analytics";

type Props = React.ComponentProps<typeof Link> & { castName: string };

/** キャストへのリンク。クリック時に click_cast を送信 */
export default function CastClickLink({ castName, onClick, ...props }: Props) {
  return (
    <Link
      {...props}
      onClick={(e) => {
        clickCast(castName);
        onClick?.(e);
      }}
    />
  );
}

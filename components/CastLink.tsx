"use client";

import Link from "next/link";
import { trackCastClick } from "@/lib/analytics";

type Props = React.ComponentProps<typeof Link> & {
  castName: string;
};

export default function CastLink({ castName, href, children, ...rest }: Props) {
  return (
    <Link
      href={href}
      onClick={() => trackCastClick(castName)}
      {...rest}
    >
      {children}
    </Link>
  );
}

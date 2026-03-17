"use client";

import { trackSnsClick } from "@/lib/analytics";

type Props = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  snsType: string;
  locationName: string;
};

export default function SnsLink({
  snsType,
  locationName,
  href,
  children,
  ...rest
}: Props) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackSnsClick(snsType, locationName)}
      {...rest}
    >
      {children}
    </a>
  );
}

"use client";

import { trackMapClick } from "@/lib/analytics";

type Props = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  locationName: string;
};

export default function MapLink({ locationName, href, children, ...rest }: Props) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackMapClick(locationName)}
      {...rest}
    >
      {children}
    </a>
  );
}

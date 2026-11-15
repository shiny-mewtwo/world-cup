import Image from "next/image";
import Link from "next/link";

import { SiteNav } from "@/components/site-nav";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/rules", label: "Rules" },
  { href: "/standings", label: "Standings" },
  { href: "/schedule", label: "Schedule" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-shell header-shell">
        <Link className="brand" href="/" aria-label="World Cup Pool home">
          <span className="brand-mark" aria-hidden="true">
            <Image
              src="/assets/ysc-flag.png"
              alt=""
              className="brand-logo"
              width={128}
              height={128}
              priority
              sizes="48px"
              unoptimized
            />
          </span>
        </Link>

        <SiteNav links={NAV_LINKS} />
        <span className="eyebrow">Archive</span>
      </div>
    </header>
  );
}

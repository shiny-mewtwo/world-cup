"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type SiteNavProps = {
  links: Array<{
    href: string;
    label: string;
  }>;
};

function isActivePath(pathname: string, href: string) {
  if (href === "/my-entries") {
    return pathname === "/my-entries" || pathname.startsWith("/entries/");
  }

  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteNav({ links }: SiteNavProps) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const mobileNavRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        mobileNavRef.current?.contains(event.target)
      ) {
        return;
      }

      setIsMenuOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  return (
    <div className="site-nav">
      <nav className="nav-links nav-links-desktop" aria-label="Primary">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={isActivePath(pathname, link.href) ? "nav-link nav-link-active" : "nav-link"}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="nav-mobile" ref={mobileNavRef}>
        <button
          type="button"
          className="nav-menu-button"
          aria-expanded={isMenuOpen}
          aria-controls="primary-menu"
          aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          onClick={() => setIsMenuOpen((current) => !current)}
        >
          <span className="nav-menu-icon" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="nav-menu-label">Menu</span>
        </button>

        {isMenuOpen ? (
          <nav id="primary-menu" className="nav-menu-panel" aria-label="Mobile primary">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMenuOpen(false)}
                className={
                  isActivePath(pathname, link.href)
                    ? "nav-link nav-link-mobile nav-link-active"
                    : "nav-link nav-link-mobile"
                }
              >
                {link.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>
    </div>
  );
}

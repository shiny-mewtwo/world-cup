import type { Metadata } from "next";
import "flag-icons/css/flag-icons.min.css";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";

// Render only the allow-listed public archive during the build.
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Scottie's World Cup Pool",
  description: "An archive of Scottie's 2026 World Cup pool, with saved predictions, standings, and match results.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        <main className="site-main">
          <div className="site-shell">{children}</div>
        </main>
      </body>
    </html>
  );
}

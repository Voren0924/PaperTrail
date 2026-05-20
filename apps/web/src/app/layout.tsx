import type { Metadata } from "next";
import Link from "next/link";

import { AppNav } from "@/components/AppNav";

import "./globals.css";

export const metadata: Metadata = {
  title: "PaperTrail",
  description:
    "Citation-grounded research assistance for computer science papers."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <header className="topbar">
            <div className="topbar__inner">
              <Link className="brand" href="/">
                <span className="brand__mark" aria-hidden="true">
                  PT
                </span>
                <span>PaperTrail</span>
              </Link>
              <AppNav />
            </div>
          </header>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}

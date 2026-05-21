import type { Metadata } from "next";
import Link from "next/link";

import { AppNav } from "@/components/AppNav";
import { SetupGate } from "@/components/SetupGate";

import "./globals.css";

export const metadata: Metadata = {
  title: "PaperTrail",
  description:
    "Local-first desktop PDF question answering with citation-grounded evidence."
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
          <main className="main">
            <SetupGate>{children}</SetupGate>
          </main>
        </div>
      </body>
    </html>
  );
}

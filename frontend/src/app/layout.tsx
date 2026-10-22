import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "BrandGuard - AI Brand Compliance & Tone Auditor",
  description: "Enterprise-grade real-time brand compliance coaching and auditing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="min-h-full flex flex-col bg-neutral-950 text-neutral-100 font-sans">
        <header className="sticky top-0 z-50 w-full border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md border border-neutral-800 bg-neutral-900 text-emerald-400">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold tracking-tight text-neutral-100">
                  BrandGuard
                </span>
                <span className="hidden rounded border border-neutral-800 bg-neutral-900 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400 sm:inline-block">
                  Enterprise
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                <span>Brand Guidelines: Active</span>
              </div>
            </div>
          </div>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Atkinson_Hyperlegible, Fraunces } from "next/font/google";
import "./globals.css";

// Atkinson Hyperlegible was designed for low-vision readers: right for older eyes and tired caregivers.
const body = Atkinson_Hyperlegible({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-body" });
const display = Fraunces({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  title: "Familiar: memory kits for people living with dementia",
  description:
    "An AI agent grounded in Qloo's cultural taste graph that builds personalised reminiscence kits (music, films, food and conversation) for people living with dementia, and learns from every session.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f3ea" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1714" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable}`}>
      <body className="min-h-dvh flex flex-col">
        <header className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Mark />
            <span className="font-display text-2xl font-semibold tracking-tight">Familiar</span>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2 text-[15px]">
            <Link href="/kits" className="px-3 py-2 rounded-full hover:bg-card">
              My kits
            </Link>
            <Link href="/new" className="btn btn-primary !py-2 !px-4 text-[15px]">
              New kit
            </Link>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-10 text-sm text-muted flex flex-col sm:flex-row gap-2 sm:justify-between">
          <p>
            Cultural grounding by the <a className="underline" href="https://www.qloo.com" target="_blank" rel="noreferrer">Qloo</a> taste graph · reasoning by Gemini
          </p>
          <p>A companion for caregivers, not medical advice.</p>
        </footer>
      </body>
    </html>
  );
}

function Mark() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="15" fill="var(--accent)" />
      <path d="M10 20c0-4 2.5-8 6-8s6 4 6 8" stroke="var(--accent-ink)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <circle cx="16" cy="9.5" r="2" fill="var(--accent-ink)" />
      <path d="M8 22.5h16" stroke="var(--accent-ink)" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

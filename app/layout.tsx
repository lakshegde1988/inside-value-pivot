import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pivot Scanner — Inside Month Breakout Finder",
  description:
    "NSE stock scanner that finds Inside Month Floor Pivot compression setups for explosive breakouts.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Syne:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#080c14] text-[#e8edf5] antialiased">{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono, Shrikhand, Space_Grotesk, League_Spartan } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const shrikhand = Shrikhand({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-shrikhand",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-future",
  display: "swap",
});

const leagueSpartan = League_Spartan({
  subsets: ["latin"],
  variable: "--font-bauhaus",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nooti Coffee — 60s/70s Vibes",
  description: "Minimal retro coffeeshop page with hours and location.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${shrikhand.variable} ${spaceGrotesk.variable} ${leagueSpartan.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

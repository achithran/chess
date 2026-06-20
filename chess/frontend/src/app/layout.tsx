import type { Metadata } from "next";
import { Inter, Noto_Sans_Malayalam } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/navbar";
import { TtsAuthBanner } from "@/components/tts-auth-banner";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const malayalam = Noto_Sans_Malayalam({
  subsets: ["malayalam"],
  variable: "--font-malayalam",
  weight: ["400", "500", "600", "700"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Chanakya — Learn Chess in Malayalam",
    template: "%s | Chanakya",
  },
  description:
    "AI chess teacher for Kerala. Move-by-move explanations in Malayalam, puzzles, opening trainer, and game review.",
  keywords: [
    "chess malayalam",
    "chess learning kerala",
    "AI chess teacher",
    "chanakya chess",
  ],
  openGraph: {
    title: "Chanakya — Learn Chess in Malayalam",
    description: "AI chess teacher for Kerala. Learn chess in your language.",
    url: siteUrl,
    siteName: "Chanakya",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${malayalam.variable} dark`}>
      <body className="min-h-screen font-sans antialiased">
        <Navbar />
        <main>{children}</main>
        <TtsAuthBanner />
      </body>
    </html>
  );
}

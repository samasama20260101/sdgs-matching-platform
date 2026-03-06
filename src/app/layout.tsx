import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "明日もsamasama | SDGs Match",
  description: "AIがあなたの困りごとを分析し、専門のNPO・支援団体・企業・行政につなげるマッチングプラットフォームです。",
  keywords: ["SDGs", "NPO", "支援", "マッチング", "相談", "社会課題"],
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180" },
    ],
  },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    title: "明日もsamasama | SDGs Match",
    description: "AIがあなたの困りごとを分析し、専門のNPO・支援団体につなげるマッチングプラットフォーム。",
    siteName: "明日もsamasama",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "明日もsamasama - SDGs Match Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "明日もsamasama | SDGs Match",
    description: "AIがあなたの困りごとを分析し、専門のNPO・支援団体につなげます。",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

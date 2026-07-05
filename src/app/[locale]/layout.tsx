import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { isAppLocale, locales } from "@/i18n/routing";
import "../globals.css";

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

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (!isAppLocale(locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
        <GoogleAnalytics gaId="G-8S5GP8P7EZ" />
      </body>
    </html>
  );
}

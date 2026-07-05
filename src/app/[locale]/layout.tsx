import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { isAppLocale, locales, type AppLocale } from "@/i18n/routing";
import "../globals.css";

// OGP用のロケール表記（BCP47 → Open Graph形式）
const OG_LOCALES: Record<AppLocale, string> = {
  ja: "ja_JP",
  en: "en_US",
  zh: "zh_CN",
  ko: "ko_KR",
  vi: "vi_VN",
  id: "id_ID",
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// hreflang の alternates は next-intl ミドルウェアが Link ヘッダで自動出力する
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = isAppLocale(locale) ? locale : "ja";
  const t = await getTranslations({ locale: resolvedLocale, namespace: "landing.meta" });
  return {
    title: t("title"),
    description: t("description"),
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
      locale: OG_LOCALES[resolvedLocale],
      title: t("title"),
      description: t("description"),
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
      title: t("title"),
      description: t("description"),
      images: ["/og-image.png"],
    },
  };
}

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

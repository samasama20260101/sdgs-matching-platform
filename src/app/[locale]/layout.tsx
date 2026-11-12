import type { Metadata } from "next";
import { Noto_Sans, Noto_Serif, Noto_Serif_JP, Zen_Maru_Gothic } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { isAppLocale, locales, type SupportedLocale } from "@/i18n/routing";
import "../globals.css";
import { SessionProvider } from "@/components/app/SessionProvider";
import { textSizeBootScript } from "@/lib/domain/textSize";

// OGP用のロケール表記（BCP47 → Open Graph形式）。非公開ロケール分も保持しておく。
const OG_LOCALES: Record<SupportedLocale, string> = {
  ja: "ja_JP",
  en: "en_US",
  es: "es_ES",
  zh: "zh_CN",
  ko: "ko_KR",
  vi: "vi_VN",
  id: "id_ID",
};

// 書体は言語ごとに Noto を切り替える(11/4 代表のコメント・盤 06)。読み込むのは表示中の言語の書体だけ:
// 使わない書体のクラスを <html> に付けないので、ブラウザはその書体のファイルを取りに行かない。
// 日本語は字の範囲ごとに分かれたファイル(unicode-range)で配られ、使う字の分だけ落ちる。
const jaBody = Zen_Maru_Gothic({ weight: ["400", "500", "700"], subsets: ["latin"], variable: "--font-v2-body", display: "swap", preload: false });
const jaHeading = Noto_Serif_JP({ weight: ["600", "700"], subsets: ["latin"], variable: "--font-v2-heading", display: "swap", preload: false });
const latinBody = Noto_Sans({ weight: ["400", "500", "700"], subsets: ["latin", "latin-ext"], variable: "--font-v2-body", display: "swap" });
const latinHeading = Noto_Serif({ weight: ["600", "700"], subsets: ["latin", "latin-ext"], variable: "--font-v2-heading", display: "swap" });

function fontClassesFor(locale: string) {
  return locale === "ja" ? `${jaBody.variable} ${jaHeading.variable}` : `${latinBody.variable} ${latinHeading.variable}`;
}

// hreflang の alternates は next-intl ミドルウェアが Link ヘッダで自動出力する
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = isAppLocale(locale) ? locale : "ja";
  const t = await getTranslations({ locale: resolvedLocale, namespace: "landing.meta" });
  return {
    title: t("title"),
    description: t("description"),
    keywords: ["SDGs", "NPO", "支援", "相談", "社会課題"],
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "48x48" },
        { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
        { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      ],
      apple: [
        { url: "/apple-touch-icon.png", sizes: "180x180" },
      ],
    },
    manifest: "/site.webmanifest",
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
    // suppressHydrationWarning: 文字の大きさの属性は、描画の前に <head> のスクリプトが <html> に付ける(サーバーの HTML にはない)
    <html lang={locale} className={fontClassesFor(locale)} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: textSizeBootScript() }} />
      </head>
      <body className="antialiased font-body">
        <NextIntlClientProvider messages={messages}>
          <SessionProvider>{children}</SessionProvider>
        </NextIntlClientProvider>
        <GoogleAnalytics gaId="G-8S5GP8P7EZ" />
      </body>
    </html>
  );
}

import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// 全ページ・全 API に付ける基本的なセキュリティヘッダー。
// CSP は Google Analytics や Next.js のインラインスクリプトとぶつかりやすいので入れていない。
// HSTS は Vercel が本番ドメインで自動で付ける。
const securityHeaders = [
  // 他サイトの画面への埋め込み(クリックジャッキング)を防ぐ。会社サイトからはリンクで移るだけなので影響しない
  { key: "X-Frame-Options", value: "DENY" },
  // ファイル種別の推測による誤実行を防ぐ
  { key: "X-Content-Type-Options", value: "nosniff" },
  // 外部サイトへ相談画面などの URL(パス)が渡らないようにする
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // 使わない端末機能を無効にする。共有ボタンのクリップボードは使うので止めない
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);

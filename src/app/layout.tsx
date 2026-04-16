import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const BASE_URL = "https://www.aimeishi.biz";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "AI名刺 | 分身AIが24時間365日あなたの代わりに商談対応",
    template: "%s | AI名刺",
  },
  description:
    "名刺のQRコードをスキャンするだけ。分身AIがあなたの代わりに24時間365日、顧客の質問に答え商談を前進させる次世代AI名刺サービス。月額¥480から。",
  keywords: [
    "AI名刺", "デジタル名刺", "分身AI", "営業自動化", "QRコード名刺",
    "AIチャット", "営業DX", "名刺管理", "AI営業", "自動対応",
  ],
  authors: [{ name: "スマイルテックエージェント" }],
  creator: "スマイルテックエージェント",
  publisher: "スマイルテックエージェント",
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: BASE_URL,
    siteName: "AI名刺",
    title: "AI名刺 | 分身AIが24時間365日あなたの代わりに商談対応",
    description:
      "名刺のQRコードをスキャンするだけ。分身AIがあなたの代わりに24時間365日、顧客の質問に答え商談を前進させる次世代AI名刺サービス。",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "AI名刺 - 分身AIが顧客対応を自動化",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI名刺 | 分身AIが24時間365日あなたの代わりに商談対応",
    description:
      "名刺のQRコードをスキャンするだけ。分身AIが顧客の質問に答え商談を前進させる次世代AI名刺サービス。月額¥480から。",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: BASE_URL,
  },
  verification: {
    google: "1aQqH_GZJ1xQARN8O3Fr0BunafGwt_cLEmNNTHb_jIg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${geistSans.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}

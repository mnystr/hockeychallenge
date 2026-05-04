import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import InstallBanner from "@/components/InstallBanner";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dict";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "hockeychallenge",
  description:
    "Off-season training challenges and leaderboards for youth hockey teams.",
  applicationName: "hockeychallenge",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "hockey" },
};

export const viewport: Viewport = {
  themeColor: "#1e3a8a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const installMessages = {
    iosTitle: translate(locale, "install.ios_title"),
    iosBody: translate(locale, "install.ios_body"),
    androidTitle: translate(locale, "install.android_title"),
    androidBody: translate(locale, "install.android_body"),
    install: translate(locale, "install.install"),
    dismiss: translate(locale, "install.dismiss"),
  };
  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="page-shell min-h-full bg-app">
        {children}
        <LanguageSwitcher />
        <InstallBanner messages={installMessages} />
      </body>
    </html>
  );
}

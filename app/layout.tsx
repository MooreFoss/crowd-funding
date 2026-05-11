import type { Metadata } from "next";
import "./globals.css";
import {
  DEFAULT_EDITABLE_SITE_SETTINGS,
  getEditableSiteSettings,
} from "@/src/application/admin";
import Navbar from "@/src/ui/components/Navbar";
import Footer from "@/src/ui/components/Footer";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getEditableSiteSettings().catch(
    () => DEFAULT_EDITABLE_SITE_SETTINGS,
  );

  return {
    title: settings.siteTitle,
    description: settings.heroDescription,
    icons: {
      icon: settings.faviconUrl,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getEditableSiteSettings().catch(
    () => DEFAULT_EDITABLE_SITE_SETTINGS,
  );

  return (
    <html lang="zh-CN" className="h-full">
      <body className="antialiased bg-slate-50 text-slate-900 min-h-full flex flex-col font-sans">
        <Navbar siteTitle={settings.siteTitle} faviconUrl={settings.faviconUrl} />
        <main className="flex-grow">
          {children}
        </main>
        <Footer siteTitle={settings.siteTitle} faviconUrl={settings.faviconUrl} />
      </body>
    </html>
  );
}

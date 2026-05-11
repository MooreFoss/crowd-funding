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
    description: "查看资金池余额、众筹记录与支出明细，支持在线赞助。",
    icons: {
      icon: settings.faviconUrl,
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className="antialiased bg-slate-50 text-slate-900 min-h-full flex flex-col font-sans">
        <Navbar />
        <main className="flex-grow">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}

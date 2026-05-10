import type { Metadata } from "next";
import { Inter, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import Navbar from "@/src/ui/components/Navbar";
import Footer from "@/src/ui/components/Footer";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "众筹系统 - 透明可追溯的资金管理平台",
  description: "查看资金池余额、众筹记录与支出明细，支持在线赞助。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full">
      <body
        className={`${inter.variable} ${ibmPlexSans.variable} antialiased bg-slate-50 text-slate-900 min-h-full flex flex-col font-sans`}
      >
        <Navbar />
        <main className="flex-grow">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}

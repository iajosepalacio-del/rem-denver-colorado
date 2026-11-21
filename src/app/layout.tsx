import type { Metadata } from "next";
import { Montserrat, Outfit } from "next/font/google";
import { getLocale } from "@/i18n/locale";
import { messages } from "@/i18n/messages";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", weight: ["500", "700", "800"] });

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const copy = messages[locale];
  return {
    title: copy.metaTitle,
    description: copy.metaDescription,
    applicationName: "REM Denver Colorado 2027",
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body className={`${outfit.variable} ${montserrat.variable} min-h-screen bg-[#F7FCFF] text-[#073B69] antialiased`}>
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { RulesProvider } from "@/contexts/RulesContext";
import { ConfigProvider } from "@/contexts/ConfigContext";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "GitHub Sensitive Data Scanner",
  description: "Scan GitHub repositories for secrets and sensitive data",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-gray-50 text-gray-900`}
      >
        <ConfigProvider>
          <RulesProvider>
            <Header />
            {children}
          </RulesProvider>
        </ConfigProvider>
      </body>
    </html>
  );
}

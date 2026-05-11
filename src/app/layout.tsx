import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";

import { AuthBootstrap } from "@/components/providers/auth-bootstrap";
import { AppThemeProvider } from "@/components/providers/app-theme-provider";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "IdleEnglish",
    template: "%s · IdleEnglish",
  },
  description:
    "Micro English lessons in a TikTok-style feed — perfect while Cursor builds or deploys.",
  applicationName: "IdleEnglish",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "IdleEnglish",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "IdleEnglish",
    title: "IdleEnglish — learn English in the idle moments",
    description:
      "Swipe through vocabulary, developer English, slang, grammar fixes, and more.",
  },
  twitter: {
    card: "summary_large_image",
    title: "IdleEnglish",
    description: "Swipe-style micro lessons while you wait.",
  },
};

export const viewport: Viewport = {
  themeColor: "#22c55e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh bg-background text-foreground">
        <AppThemeProvider>
          <AuthBootstrap />
          {children}
          <Toaster richColors closeButton position="top-center" theme="dark" />
        </AppThemeProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "TIGOM",
    template: "%s · TIGOM",
  },
  applicationName: "TIGOM",
  description: "Save with purpose. A personal tracker for accounts, income, expenses, and savings goals.",
  icons: {
    icon: "/tigom-mark.svg",
    shortcut: "/tigom-mark.svg",
    apple: "/tigom-mark.svg",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
        >
          <TooltipProvider delayDuration={200}>
            {children}
            <Toaster position="top-right" />
          </TooltipProvider>
        </ThemeProvider>
        <svg aria-hidden="true" className="pointer-events-none fixed size-0" focusable="false">
          <filter id="theme-liquid-warp" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.012 0.018"
              numOctaves="2"
              seed="8"
              result="noise"
            >
              <animate
                attributeName="baseFrequency"
                values="0.012 0.018;0.018 0.012;0.012 0.018"
                dur="620ms"
                repeatCount="1"
              />
              <animate attributeName="seed" values="8;12;8" dur="620ms" repeatCount="1" />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="34" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </svg>
      </body>
    </html>
  );
}

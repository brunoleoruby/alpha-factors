import type { Metadata } from "next";
import { Cormorant_Garamond, Geist, Geist_Mono } from "next/font/google";
import { DeskChrome } from "@/components/desk/desk-chrome";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Eminent Corpus",
  description: "Long/short equity partner dashboard.",
  icons: {
    icon: "/brand/eminent-corpus-mark.svg",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-palette="ink"
      className={`dark ${geistSans.variable} ${geistMono.variable} ${cormorant.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var p=localStorage.getItem("ec-palette");var ok=["ink","bone","claret","gallery","sea","plum","copper"];document.documentElement.dataset.palette=ok.indexOf(p)>=0?p:"ink"}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <TooltipProvider>
          <DeskChrome>{children}</DeskChrome>
        </TooltipProvider>
      </body>
    </html>
  );
}

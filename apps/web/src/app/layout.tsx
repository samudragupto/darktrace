import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppClientProviders } from "@/components/providers/AppClientProviders";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { TopBar } from "@/components/layout/TopBar";

export const metadata: Metadata = {
  title: "DarkTrace | MEV Forensics for Uniswap v4 LPs",
  description: "Detect MEV extraction on Uniswap v4, seal proof on Arkiv, claim USDC rebates on Arc.",
};

export const viewport: Viewport = {
  themeColor: "#121315",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-text antialiased">
        <AppClientProviders>
          <a href="#main" className="skip-link">
            Skip to main content
          </a>
          <div className="min-h-screen flex flex-col lg:flex-row gap-3 lg:gap-4 p-2 sm:p-3 lg:p-4">
            <Header />
            <div className="flex-1 min-w-0 flex flex-col gap-3 lg:gap-4">
              <TopBar />
              <main id="main" tabIndex={-1} className="flex-1 flex flex-col focus:outline-none">
                {children}
              </main>
              <Footer />
            </div>
          </div>
        </AppClientProviders>
      </body>
    </html>
  );
}


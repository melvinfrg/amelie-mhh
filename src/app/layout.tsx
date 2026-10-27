import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import { Shell } from "@/components/Shell";
import "./globals.css";

// The fonts of Die Batzi's, so all three areas feel like one site.
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito" });
const fredoka = Fredoka({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-fredoka" });

export const metadata: Metadata = {
  title: "Amelie & Melvin",
  description: "Studium MHH, Die Batzi's und Melvins Seite unter einem Login",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className={`h-full antialiased ${nunito.variable} ${fredoka.variable}`}>
      <body className="min-h-full">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/app/providers";

export const metadata: Metadata = {
  title: "Paper2Product AI",
  description: "From research paper to deployed MVP — automatically."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="noise fixed inset-0 opacity-50" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}



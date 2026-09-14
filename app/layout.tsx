import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Purchasing Agent",
  description: "An auditable purchasing agent for high-confidence buying decisions.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

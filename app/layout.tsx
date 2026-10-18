import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KiranaProof | Delivery reconciliation",
  description: "Check the whole delivery. Speak the exceptions. Resolve only what is wrong.",
  applicationName: "KiranaProof",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}

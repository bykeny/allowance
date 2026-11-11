import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Allowance: spending rules for AI agents",
  description: "A PayPal-backed spend firewall for AI agents: auto-pay in policy, escalate to a human over limit, deny the rest.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="h-full">{children}</body>
    </html>
  );
}

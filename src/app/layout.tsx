import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ArclivoLabs Employee Portal",
    template: "%s | ArclivoLabs",
  },
  description: "Internal employee workspace for ArclivoLabs.",
  icons: { icon: "/artwork/arclivo-mark.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

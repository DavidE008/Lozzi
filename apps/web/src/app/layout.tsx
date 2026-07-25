import { brandConfig } from "@lozzi/domain";
import type { Metadata, Viewport } from "next";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/lora/600.css";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: brandConfig.metadata.applicationName,
  title: {
    default: brandConfig.name,
    template: `%s · ${brandConfig.name}`,
  },
  description: brandConfig.description,
};

export const viewport: Viewport = {
  themeColor: brandConfig.metadata.themeColor,
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}

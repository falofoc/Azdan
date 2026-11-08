import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "وسطاء إزدان", template: "%s · وسطاء إزدان" },
  description: "منصة وسطاء إزدان العقارية: سوّق مشاريع إزدان، احمِ عملاءك، وتابع عمولتك بوضوح.",
  icons: { icon: "/brand/favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#3a3f35" },
    { media: "(prefers-color-scheme: dark)", color: "#11130f" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}

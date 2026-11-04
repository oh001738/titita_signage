import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "TITITA | 音樂的日常",
  description: "TITITA 大廳資訊看板與獨立內容管理",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}

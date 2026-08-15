import type { Metadata } from "next";
import { Inter, Geist_Mono, Audiowide } from "next/font/google";
import { RootProvider } from "fumadocs-ui/provider/next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const audiowide = Audiowide({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-audiowide",
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "emailmd - Responsive Emails, Written in Markdown",
  description:
    "Turn markdown into responsive, email-safe HTML that renders perfectly across every client.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${audiowide.variable}`}
      suppressHydrationWarning
    >
      <body className={`${geistMono.variable} antialiased`}>
        <RootProvider>{children}</RootProvider>
        {/* No-ops off Vercel and in dev; forks report to their own project. */}
        <Analytics />
      </body>
    </html>
  );
}

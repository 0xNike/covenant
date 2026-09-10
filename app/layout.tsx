import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import SiteNav from "./components/site-nav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// the tab title is on camera whenever the browser chrome is in frame, and
// "Create Next App" in a submission video is the kind of detail a judge reads as
// unfinished. each route sets its own title through this template.
export const metadata: Metadata = {
  title: {
    default: "covenant",
    template: "%s | covenant",
  },
  description:
    "a tokenised private credit note priced by a confidential covenant engine, on hedera",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SiteNav />
        {children}
      </body>
    </html>
  );
}

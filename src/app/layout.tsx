import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"], weight: ["600", "700"],
  variable: "--font-bricolage", display: "swap",
});
const instrument = Instrument_Sans({
  subsets: ["latin"], weight: ["400", "500", "600"],
  variable: "--font-instrument", display: "swap",
});

export const metadata: Metadata = {
  title: "Tracck",
  description: "Resumes built from work you can show, with a source behind every claim.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${bricolage.variable} ${instrument.variable}`}>
      <body>{children}</body>
    </html>
  );
}

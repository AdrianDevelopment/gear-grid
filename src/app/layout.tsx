import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import DashboardLayout from "../components/DashboardLayout";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gear Grid",
  description: "Packliste für die nächste Reise",
  icons: {
    icon: "/logo.svg",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <DashboardLayout>{children}</DashboardLayout>
      </body>
    </html>
  );
}


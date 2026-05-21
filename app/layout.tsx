import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clinexio — Draft Quality Tester",
  description:
    "Test how the Clinexio AI would respond to a patient question, side-by-side for two clinics.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import Providers from "./providers";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: {
    default: "Gobi | Logistics & Delivery",
    template: "%s | Gobi",
  },
  description:
    "Gobi MVP is a simplified logistics and delivery platform. Send packages with verified drivers and track every step.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={dmSans.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Archivo, DM_Sans } from "next/font/google";
import Providers from "./providers";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
});

// Display face for titles and figures; its width axis gives headings a wide,
// freight-signage stance (see .font-display in globals.css).
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: {
    default: "Gobi | Shipment coordination",
    template: "%s | Gobi",
  },
  description:
    "Gobi is the shipment coordination workspace for shippers, carriers, clearing agents and drivers: one timeline, one document checklist and one audit trail per shipment.",
};

export const viewport: Viewport = {
  themeColor: "#ECEFF5",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${archivo.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

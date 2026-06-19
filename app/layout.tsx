import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Microlynx — Ticketing",
  description: "Repair ticketing for Microlynx, Gig Harbor.",
};

// Render at the device's real width on phones/tablets (not a zoomed-out desktop
// page). Pinch-zoom stays enabled for accessibility — no maximum-scale lock.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div id="root">{children}</div>
      </body>
    </html>
  );
}

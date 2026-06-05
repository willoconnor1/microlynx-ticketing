import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Microlynx — Ticketing",
  description: "Repair ticketing for Microlynx, Gig Harbor.",
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

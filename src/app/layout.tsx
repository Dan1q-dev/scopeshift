import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ScopeShift | Beyond Horizon",
  description: "Practice client negotiation and understand the cost of scope changes.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

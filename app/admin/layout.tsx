import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "AstroRoast Admin",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin — Astroroast",
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The marketing site hides the native cursor (globals.css `:root`) in favour
  // of a custom one. The admin console is a tool, not an experience — restore a
  // normal cursor so it behaves like an ordinary dashboard.
  return (
    <div
      style={{ cursor: "auto", minHeight: "100vh" }}
      className="bg-void text-ash"
    >
      {children}
    </div>
  );
}

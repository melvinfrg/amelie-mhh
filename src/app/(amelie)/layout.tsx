import type { Metadata } from "next";

// Amelie's area (Studium and everything around it): the logo with Melvin's M faded out.
export const metadata: Metadata = {
  manifest: "/amelie.webmanifest",
};

export default function AmelieLayout({ children }: { children: React.ReactNode }) {
  return children;
}

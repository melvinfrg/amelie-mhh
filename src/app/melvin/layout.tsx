import type { Metadata } from "next";

// Melvin's own shortcut: the logo with Amelie's A faded out.
export const metadata: Metadata = {
  manifest: "/melvin.webmanifest",
};

export default function MelvinLayout({ children }: LayoutProps<"/melvin">) {
  return children;
}

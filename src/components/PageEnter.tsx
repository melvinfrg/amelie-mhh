"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, type ReactNode } from "react";

/**
 * Fades each new page in when the route changes. The page is not remounted (that would reset shared layouts such as
 * the Lernen tabs); the wrapper just replays a short animation. Skipped when the system asks for reduced motion.
 */
export function PageEnter({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof el.animate !== "function" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const anim = el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: "ease-out" });
    return () => anim.cancel();
  }, [pathname]);

  return <div ref={ref}>{children}</div>;
}

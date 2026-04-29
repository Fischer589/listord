"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

export function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();

  useEffect(() => {
    try {
      trackEvent("page_view", {
        path: queryString ? `${pathname}?${queryString}` : pathname
      });
    } catch (error) {
      console.warn("Page view analytics failed.", {
        name: error instanceof Error ? error.name : "UnknownError"
      });
    }
  }, [pathname, queryString]);

  return null;
}

"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

export function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();

  useEffect(() => {
    trackEvent("page_view", {
      path: queryString ? `${pathname}?${queryString}` : pathname
    });
  }, [pathname, queryString]);

  return null;
}

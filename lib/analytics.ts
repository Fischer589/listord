"use client";

export type AnalyticsEventName =
  | "page_view"
  | "worker_view"
  | "contact_click"
  | "paywall_open"
  | "checkout_start"
  | "checkout_success";

export type AnalyticsMetadata = Record<
  string,
  string | number | boolean | null | undefined
>;

export const BROWSER_SESSION_STORAGE_KEY = "listord_browser_session_id";

export function getBrowserSessionId() {
  const existing = localStorage.getItem(BROWSER_SESSION_STORAGE_KEY);

  if (existing) {
    return existing;
  }

  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(BROWSER_SESSION_STORAGE_KEY, id);

  return id;
}

export function trackEvent(
  eventName: AnalyticsEventName,
  metadata: AnalyticsMetadata = {}
) {
  const sessionId = getBrowserSessionId();

  void fetch("/api/analytics/events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      event_name: eventName,
      metadata: {
        ...metadata,
        session_id: sessionId
      }
    }),
    keepalive: true
  }).catch(() => {
    // Analytics should never block the user flow.
  });
}

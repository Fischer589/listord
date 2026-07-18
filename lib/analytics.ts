"use client";

export type AnalyticsEventName =
  | "page_view"
  | "worker_view"
  | "contact_click"
  | "paywall_open"
  | "checkout_start"
  | "checkout_success"
  // Worker profile boost — admin-only analytics, never shown publicly
  | "boost_purchase_started"
  | "boost_payment_success"
  | "boost_activated"
  | "boost_expired"
  | "boosted_profile_view"
  | "boost_contact_initiated";

export type AnalyticsMetadata = Record<
  string,
  string | number | boolean | null | undefined
>;

export const BROWSER_SESSION_STORAGE_KEY = "listord_browser_session_id";

let fallbackBrowserSessionId = "";

export function getBrowserSessionId() {
  try {
    const existing = localStorage.getItem(BROWSER_SESSION_STORAGE_KEY);

    if (existing) {
      return existing;
    }

    const id = createBrowserSessionId();
    localStorage.setItem(BROWSER_SESSION_STORAGE_KEY, id);

    return id;
  } catch (error) {
    console.warn("Browser session storage failed.", {
      name: error instanceof Error ? error.name : "UnknownError"
    });

    if (!fallbackBrowserSessionId) {
      fallbackBrowserSessionId = createBrowserSessionId();
    }

    return fallbackBrowserSessionId;
  }
}

function createBrowserSessionId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function trackEvent(
  eventName: AnalyticsEventName,
  metadata: AnalyticsMetadata = {}
) {
  try {
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
    })
      .then((response) => {
        if (!response.ok) {
          console.warn("Analytics event was not accepted.", {
            eventName,
            status: response.status
          });
        }
      })
      .catch((error) => {
        console.warn("Analytics event request failed.", {
          name: error instanceof Error ? error.name : "UnknownError"
        });
      });
  } catch (error) {
    console.warn("Analytics event tracking failed.", {
      name: error instanceof Error ? error.name : "UnknownError"
    });
  }
}

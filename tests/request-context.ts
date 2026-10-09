import "next/dist/server/node-environment";
import { workAsyncStorage } from "next/dist/server/app-render/work-async-storage.external";
import { workUnitAsyncStorage } from "next/dist/server/app-render/work-unit-async-storage.external";
import { RequestCookies } from "next/dist/server/web/spec-extension/cookies";

/** Match the installed Next 15 request context, including its real cookie adapter. */
export function withAdminCookie<T>(value: string | undefined, callback: () => T): T {
  const cookies = new RequestCookies(new Headers(value ? { cookie: `admin_session=${value}` } : {}));
  const work = { route: "/admin/workers", isStaticGeneration: false } as Parameters<typeof workAsyncStorage.run>[0];
  const request = { type: "request", phase: "render", cookies } as unknown as Parameters<typeof workUnitAsyncStorage.run>[0];
  return workAsyncStorage.run(work, () => workUnitAsyncStorage.run(request, callback));
}

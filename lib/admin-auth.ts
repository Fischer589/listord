import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isAdminSession } from "./admin-session";

/** Every privileged read/action must check authorization, even behind middleware. */
export function requireAdmin() {
  if (!isAdminSession(cookies().get("admin_session")?.value, process.env.ADMIN_SESSION_SECRET)) {
    redirect("/admin/login");
  }
}

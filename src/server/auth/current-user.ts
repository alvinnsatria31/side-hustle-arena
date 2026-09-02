import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser } from "./session";

export { getCurrentUser };

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login?returnTo=/app");
  return user;
}

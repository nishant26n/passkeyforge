import { cookies } from "next/headers";
import { getSession } from "./session";

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;

  if (!token) {
    return null;
  }

  const session = await getSession(token);

  if (!session) {
    return null;
  }

  return session.user;
}

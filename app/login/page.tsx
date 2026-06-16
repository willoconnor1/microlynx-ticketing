import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, expectedToken } from "@/lib/auth";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Already unlocked? Skip the login screen.
  const expected = await expectedToken();
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  if (expected && token === expected) redirect("/");

  return <LoginForm />;
}

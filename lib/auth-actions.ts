"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, AUTH_MAX_AGE, tokenFor } from "./auth";

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  // Trim both sides: a stray space/newline pasted into APP_PASSWORD (or typed)
  // shouldn't cause a phantom mismatch. Must stay in sync with expectedToken().
  const password = String(formData.get("password") ?? "").trim();
  const expected = process.env.APP_PASSWORD?.trim();

  if (!expected) return { error: "No password is configured yet. Set APP_PASSWORD in the environment." };
  if (password !== expected) return { error: "That password isn't right. Try again." };

  const jar = await cookies();
  jar.set(AUTH_COOKIE, await tokenFor(expected), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_MAX_AGE,
  });
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  jar.delete(AUTH_COOKIE);
  redirect("/login");
}

import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

export const sessionCookieName = "papertrail_session";
export const sessionDurationMs = 1000 * 60 * 60 * 24 * 30;

export type CookieReader = {
  get(name: string): { value: string } | undefined;
};

export async function getSessionTokenFromCookies(cookieReader?: CookieReader): Promise<string | null> {
  const cookieStore = cookieReader ?? (await cookies());
  return cookieStore.get(sessionCookieName)?.value ?? null;
}

export function getSessionExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + sessionDurationMs);
}

export function setSessionCookie(response: NextResponse, token: string, expiresAt: Date): void {
  response.cookies.set({
    name: sessionCookieName,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: sessionCookieName,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}

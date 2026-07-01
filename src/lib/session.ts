import { cookies } from "next/headers";
import { db } from "./db";
import crypto from "crypto";

const COOKIE_NAME = "gateway_session";

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function createSession() {
  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

  // Store in database
  await db.session.create({
    data: {
      token,
      expiresAt,
    },
  });

  // Set the cookie
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });

  return token;
}

export async function verifySession(token: string) {
  if (!token) return null;

  try {
    const session = await db.session.findUnique({
      where: { token },
    });

    if (!session) return null;

    if (new Date() > session.expiresAt) {
      // Session expired, remove it
      await db.session.delete({ where: { token } }).catch(() => {});
      return null;
    }

    return session;
  } catch (error) {
    console.error("verifySession error:", error);
    return null;
  }
}

export async function destroySession() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (token) {
      await db.session.delete({ where: { token } }).catch(() => {});
    }

    cookieStore.set(COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: new Date(0),
      path: "/",
    });
  } catch (error) {
    console.error("destroySession error:", error);
  }
}

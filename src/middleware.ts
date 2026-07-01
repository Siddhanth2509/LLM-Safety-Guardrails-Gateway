import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Bypass public paths
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname === "/login" ||
    pathname === "/api/login" ||
    pathname === "/favicon.ico" ||
    pathname === "/logo.svg" ||
    pathname === "/api/auth/verify"
  ) {
    return NextResponse.next();
  }

  // 2. Protect /api/gateway (support either external API Key OR active session cookie)
  if (pathname === "/api/gateway") {
    const apiKeyHeader = request.headers.get("x-api-key");
    const authHeader = request.headers.get("authorization");
    const envApiKey = process.env.GATEWAY_API_KEY || "sk-gateway-demo-key-12345";

    let providedKey = apiKeyHeader;
    if (!providedKey && authHeader?.startsWith("Bearer ")) {
      providedKey = authHeader.substring(7);
    }

    // If key matches, bypass authentication
    if (providedKey === envApiKey) {
      return NextResponse.next();
    }
  }

  // 3. Authenticate standard routes using session cookie
  const sessionCookie = request.cookies.get("gateway_session")?.value;

  if (!sessionCookie) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Verify the session cookie via the internal API route
  try {
    const verifyUrl = new URL("/api/auth/verify", request.url);
    const res = await fetch(verifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token: sessionCookie }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.valid) {
        return NextResponse.next();
      }
    }
  } catch (err) {
    console.error("Middleware session verification failed:", err);
  }

  // If session cookie verification failed
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

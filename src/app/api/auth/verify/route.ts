import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();
    if (!token) {
      return NextResponse.json({ valid: false }, { status: 400 });
    }

    const session = await verifySession(token);
    if (session) {
      return NextResponse.json({ valid: true });
    }

    return NextResponse.json({ valid: false });
  } catch (error) {
    console.error("Auth verify error:", error);
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}

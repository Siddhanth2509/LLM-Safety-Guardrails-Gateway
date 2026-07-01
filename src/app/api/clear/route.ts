import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function DELETE() {
  try {
    await db.gatewayLog.deleteMany({});
    return NextResponse.json({ success: true, message: "All logs cleared." });
  } catch (error) {
    console.error("Clear error:", error);
    return NextResponse.json({ error: "Failed to clear logs." }, { status: 500 });
  }
}
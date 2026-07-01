import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/dashboard — Stats for the dashboard
export async function GET() {
  try {
    const [total, blocked, modified, allowed, recent] = await Promise.all([
      db.gatewayLog.count(),
      db.gatewayLog.count({ where: { status: "blocked" } }),
      db.gatewayLog.count({ where: { status: "modified" } }),
      db.gatewayLog.count({ where: { status: "allowed" } }),
      db.gatewayLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          requestId: true,
          direction: true,
          inputText: true,
          outputText: true,
          status: true,
          blockedBy: true,
          reason: true,
          latencyMs: true,
          piiFound: true,
          createdAt: true,
        },
      }),
    ]);

    // Blocked-by breakdown
    const blockedByStats = await db.gatewayLog.groupBy({
      by: ["blockedBy"],
      where: { status: "blocked", blockedBy: { not: null } },
      _count: true,
    });

    // Avg latency
    const avgResult = await db.gatewayLog.aggregate({
      _avg: { latencyMs: true },
      _max: { latencyMs: true },
    });

    // Per-day counts (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dailyCounts = await db.gatewayLog.groupBy({
      by: ["createdAt"],
      where: { createdAt: { gte: sevenDaysAgo } },
      _count: true,
    });

    return NextResponse.json({
      stats: {
        total,
        blocked,
        modified,
        allowed,
        blockRate: total > 0 ? ((blocked / total) * 100).toFixed(1) : "0",
        avgLatency: Math.round(avgResult._avg.latencyMs || 0),
        maxLatency: avgResult._max.latencyMs || 0,
      },
      blockedBy: blockedByStats.map((b) => ({
        type: b.blockedBy || "unknown",
        count: b._count,
      })),
      recent,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json(
      { error: "Failed to load dashboard." },
      { status: 500 }
    );
  }
}
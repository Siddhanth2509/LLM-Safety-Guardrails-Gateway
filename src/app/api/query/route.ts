import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runPipeline } from "@/lib/rag/pipeline";

// POST /api/query — Run the self-healing RAG pipeline
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query } = body;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return NextResponse.json(
        { error: "A non-empty query is required." },
        { status: 400 }
      );
    }

    // Fetch all chunks from the knowledge base
    const chunks = await db.chunk.findMany({
      select: {
        id: true,
        text: true,
        documentId: true,
        chunkIndex: true,
      },
    });

    if (chunks.length === 0) {
      return NextResponse.json({
        answer:
          "The knowledge base is empty. Please upload some documents first before asking questions.",
        status: "fallback",
        iterations: 0,
        events: [
          {
            step: "fallback",
            iteration: 0,
            timestamp: Date.now(),
            detail: "No documents in knowledge base",
          },
        ],
        retrievedChunks: [],
        latencyMs: 0,
      });
    }

    // Run the self-healing pipeline
    const result = await runPipeline(query.trim(), chunks);

    // Log the query
    await db.queryLog.create({
      data: {
        query: query.trim(),
        answer: result.answer,
        status: result.status,
        iterations: result.iterations,
        chunksUsed: JSON.stringify(result.retrievedChunks.map((c) => c.id)),
        pipelineLog: JSON.stringify(
          result.events.map((e) => ({
            step: e.step,
            iteration: e.iteration,
            detail: e.detail,
            grounded: e.critique?.grounded,
            confidence: e.critique?.confidence,
          }))
        ),
        latencyMs: result.latencyMs,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error running RAG pipeline:", error);
    return NextResponse.json(
      { error: "Failed to process query. Please try again." },
      { status: 500 }
    );
  }
}

// GET /api/query — Get query history
export async function GET() {
  try {
    const logs = await db.queryLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        query: true,
        answer: true,
        status: true,
        iterations: true,
        latencyMs: true,
        createdAt: true,
        pipelineLog: true,
      },
    });

    return NextResponse.json({ logs });
  } catch (error) {
    console.error("Error fetching query logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch query history." },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chunkText } from "@/lib/rag/chunker";

// POST /api/documents — Upload a new document (text content)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, content } = body;

    if (!title || !content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json(
        { error: "Title and non-empty content are required." },
        { status: 400 }
      );
    }

    // Chunk the document
    const chunks = chunkText(content);

    // Create document and chunks in a transaction
    const document = await db.document.create({
      data: {
        title,
        content,
        chunkCount: chunks.length,
        chunks: {
          create: chunks.map((chunk) => ({
            text: chunk.text,
            chunkIndex: chunk.index,
          })),
        },
      },
      include: { chunks: true },
    });

    return NextResponse.json({
      id: document.id,
      title: document.title,
      chunkCount: document.chunkCount,
      createdAt: document.createdAt,
    });
  } catch (error) {
    console.error("Error creating document:", error);
    return NextResponse.json(
      { error: "Failed to create document." },
      { status: 500 }
    );
  }
}

// GET /api/documents — List all documents
export async function GET() {
  try {
    const documents = await db.document.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        chunkCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Also get total chunks count
    const totalChunks = await db.chunk.count();

    return NextResponse.json({ documents, totalChunks });
  } catch (error) {
    console.error("Error listing documents:", error);
    return NextResponse.json(
      { error: "Failed to list documents." },
      { status: 500 }
    );
  }
}

// DELETE /api/documents — Delete a document by ID (query param)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Document ID is required." }, { status: 400 });
    }

    // Chunks are cascade-deleted via Prisma relation
    await db.document.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting document:", error);
    return NextResponse.json(
      { error: "Failed to delete document." },
      { status: 500 }
    );
  }
}
/**
 * Self-Healing RAG Pipeline
 *
 * Architecture:
 *   1. RETRIEVE — Find relevant chunks from the knowledge base
 *   2. GENERATE — Produce an answer using the LLM with retrieved context
 *   3. CRITIQUE  — A second LLM call evaluates if the answer is grounded in the sources
 *   4. HEAL      — If rejected, reformulate the query and retry (up to maxRetries)
 *   5. FALLBACK  — If still failing after retries, return an honest "I don't know" response
 */

import { retrieve, RetrievedChunk } from "./retriever";
import { chat, LLMMessage } from "./llm";

// ─── Types ───────────────────────────────────────────────────────────

export type PipelineStep =
  | "retrieving"
  | "generating"
  | "critiquing"
  | "reformulating"
  | "accepted"
  | "fallback";

export interface PipelineEvent {
  step: PipelineStep;
  iteration: number;
  timestamp: number;
  detail?: string;
  chunks?: { id: string; text: string; score: number }[];
  critique?: CritiqueResult;
}

export interface CritiqueResult {
  grounded: boolean;
  reason: string;
  confidence: number; // 0-1
}

export interface PipelineResult {
  answer: string;
  status: "accepted" | "rejected" | "max_retries" | "fallback";
  iterations: number;
  events: PipelineEvent[];
  retrievedChunks: RetrievedChunk[];
  latencyMs: number;
}

interface ChunkData {
  id: string;
  text: string;
  documentId: string;
  chunkIndex: number;
}

// ─── Configuration ───────────────────────────────────────────────────

const MAX_RETRIES = 3;
const TOP_K_CHUNKS = 5;

// ─── Prompts ─────────────────────────────────────────────────────────

const GENERATION_SYSTEM_PROMPT = `You are a knowledgeable assistant that answers questions based ONLY on the provided context.
Rules:
- Answer using only information from the provided context chunks.
- If the context doesn't contain enough information, say so explicitly.
- Cite which part of the context supports your answer.
- Be concise but thorough.`;

const CRITIQUE_SYSTEM_PROMPT = `You are a strict fact-checker. Your job is to evaluate whether an answer is grounded in the provided source chunks.

Evaluate the answer and respond in this exact JSON format (no markdown, no code fences):
{"grounded": true/false, "reason": "explanation", "confidence": 0.0-1.0}

Criteria:
- "grounded": true only if EVERY claim in the answer is directly supported by the source chunks
- "reason": explain what is grounded, what is not, and why
- "confidence": how confident you are in your assessment (0.0 to 1.0)

Be strict. Hallucinations — even small ones — should result in grounded=false.`;

const REFORMULATE_SYSTEM_PROMPT = `You are a query reformulation expert. Given the original question and the reason a previous answer was rejected, generate a more specific, targeted question that would yield better results from a knowledge base.

Rules:
- Make the query more specific and targeted
- Focus on the key information gap identified in the rejection reason
- Keep the reformulated question natural and concise
- Output ONLY the reformulated question, nothing else`;

// ─── Pipeline ────────────────────────────────────────────────────────

export async function runPipeline(
  query: string,
  allChunks: ChunkData[],
  onEvent?: (event: PipelineEvent) => void
): Promise<PipelineResult> {
  const startTime = Date.now();
  const events: PipelineEvent[] = [];
  let currentQuery = query;
  let retrievedChunks: RetrievedChunk[] = [];
  let finalAnswer = "";
  let finalStatus: PipelineResult["status"] = "max_retries";

  function emit(event: PipelineEvent) {
    events.push(event);
    onEvent?.(event);
  }

  for (let iteration = 1; iteration <= MAX_RETRIES + 1; iteration++) {
    // ── Step 1: Retrieve ──
    emit({
      step: "retrieving",
      iteration,
      timestamp: Date.now(),
    });

    retrievedChunks = retrieve(currentQuery, allChunks, TOP_K_CHUNKS);

    emit({
      step: "retrieving",
      iteration,
      timestamp: Date.now(),
      detail: `Found ${retrievedChunks.length} relevant chunks`,
      chunks: retrievedChunks.map((c) => ({
        id: c.id,
        text: c.text,
        score: c.score,
      })),
    });

    // If no chunks found, go straight to fallback
    if (retrievedChunks.length === 0) {
      finalAnswer =
        "I don't have enough information in the knowledge base to answer this question. Try uploading relevant documents first.";
      finalStatus = "fallback";
      emit({
        step: "fallback",
        iteration,
        timestamp: Date.now(),
        detail: "No relevant chunks found in knowledge base",
      });
      break;
    }

    // ── Step 2: Generate ──
    emit({
      step: "generating",
      iteration,
      timestamp: Date.now(),
    });

    const contextText = retrievedChunks
      .map((c, i) => `[Chunk ${i + 1}]: ${c.text}`)
      .join("\n\n");

    const answer = await chat([
      { role: "system", content: GENERATION_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Context:\n${contextText}\n\nQuestion: ${currentQuery}`,
      },
    ]);

    emit({
      step: "generating",
      iteration,
      timestamp: Date.now(),
      detail: `Generated answer (${answer.length} chars)`,
    });

    // ── Step 3: Critique ──
    emit({
      step: "critiquing",
      iteration,
      timestamp: Date.now(),
    });

    const critiqueRaw = await chat([
      { role: "system", content: CRITIQUE_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Source chunks:\n${contextText}\n\nAnswer to evaluate:\n${answer}`,
      },
    ]);

    let critique: CritiqueResult;
    try {
      // Try to parse the JSON response, handling potential markdown fences
      const cleaned = critiqueRaw
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      critique = JSON.parse(cleaned);
    } catch {
      // If parsing fails, default to accepting (lenient on format errors)
      critique = {
        grounded: true,
        reason: "Could not parse critique response, defaulting to accepted.",
        confidence: 0.5,
      };
    }

    emit({
      step: "critiquing",
      iteration,
      timestamp: Date.now(),
      detail: `Grounded: ${critique.grounded}, Confidence: ${critique.confidence}`,
      critique,
    });

    // ── Step 4: Accept or Heal ──
    if (critique.grounded && critique.confidence >= 0.6) {
      finalAnswer = answer;
      finalStatus = "accepted";
      emit({
        step: "accepted",
        iteration,
        timestamp: Date.now(),
        detail: "Answer passed critique check",
      });
      break;
    }

    // Answer was rejected — heal
    if (iteration <= MAX_RETRIES) {
      emit({
        step: "reformulating",
        iteration,
        timestamp: Date.now(),
        detail: `Rejection reason: ${critique.reason}`,
      });

      const reformulated = await chat([
        { role: "system", content: REFORMULATE_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Original question: ${query}\nRejection reason: ${critique.reason}\n\nReformulate the question to be more specific and better targeted.`,
        },
      ]);

      currentQuery = reformulated;

      emit({
        step: "reformulating",
        iteration,
        timestamp: Date.now(),
        detail: `Reformulated query: ${reformulated}`,
      });
    } else {
      // Max retries exhausted — return the best answer we got with a disclaimer
      finalAnswer =
        answer +
        "\n\n---\n*Note: This answer could not be fully verified against the source documents after multiple attempts. Please verify the information independently.*";
      finalStatus = "max_retries";
      emit({
        step: "fallback",
        iteration,
        timestamp: Date.now(),
        detail: "Max retries reached, returning best answer with disclaimer",
      });
    }
  }

  return {
    answer: finalAnswer,
    status: finalStatus,
    iterations: events.filter((e) => e.step === "critiquing").length,
    events,
    retrievedChunks,
    latencyMs: Date.now() - startTime,
  };
}
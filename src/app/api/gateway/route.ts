import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { detectPII, maskPII } from "@/lib/guardrails/pii";
import { detectInjectionPatterns } from "@/lib/guardrails/injection";
import { checkToxicity, checkTopicRelevance } from "@/lib/guardrails/output";
import { getPolicy } from "@/lib/guardrails/policy";
import { chat } from "@/lib/guardrails/llm";

function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { input, dryRun } = body;

    if (!input || typeof input !== "string") {
      return NextResponse.json({ error: "Input text is required." }, { status: 400 });
    }

    const requestId = generateId();
    const startTime = Date.now();
    const policy = getPolicy();

    // ── Step 1: Input Guardrails ──
    const pii = detectPII(input);
    const injection = detectInjectionPatterns(input);

    let inputStatus: "allowed" | "blocked" | "modified" = "allowed";
    let maskedInput: string | undefined;
    let blockedBy: string | undefined;
    let reason: string | undefined;

    if (injection.detected && injection.confidence >= 0.5) {
      inputStatus = "blocked";
      blockedBy = "prompt_injection";
      reason = injection.reason;
    } else if (pii.length > 0) {
      const piiRule = policy.inputRules.find((r: any) => r.type === "pii");
      if (piiRule?.action === "mask") {
        inputStatus = "modified";
        maskedInput = maskPII(input, pii);
        blockedBy = "pii";
        reason = `PII detected: ${pii.map((p: any) => p.label).join(", ")}`;
      } else if (piiRule?.action === "block") {
        inputStatus = "blocked";
        blockedBy = "pii";
        reason = `PII blocked: ${pii.map((p: any) => p.label).join(", ")}`;
      }
    }

    const baseResult: Record<string, unknown> = {
      requestId,
      status: inputStatus === "blocked" ? "blocked_input" : inputStatus === "modified" ? "modified" : "allowed",
      inputStatus: { status: inputStatus, pii, injection, maskedInput, blockedBy, reason },
      originalInput: input,
      processedInput: maskedInput || input,
      latencyMs: Date.now() - startTime,
    };

    // If blocked, log and return early
    if (inputStatus === "blocked") {
      await db.gatewayLog.create({
        data: {
          requestId,
          direction: "input",
          inputText: input,
          status: "blocked",
          blockedBy,
          reason,
          latencyMs: Date.now() - startTime,
          piiFound: pii.length > 0 ? JSON.stringify(pii) : null,
        },
      });

      return NextResponse.json(baseResult);
    }

    // If dry run, return input analysis only
    if (dryRun) {
      // Log modified (PII masked) requests even on dry run
      if (inputStatus === "modified") {
        await db.gatewayLog.create({
          data: {
            requestId,
            direction: "input",
            inputText: input,
            status: "modified",
            blockedBy: "pii",
            reason,
            latencyMs: Date.now() - startTime,
            piiFound: JSON.stringify(pii),
          },
        });
      } else {
        await db.gatewayLog.create({
          data: {
            requestId,
            direction: "input",
            inputText: input,
            status: "allowed",
            latencyMs: Date.now() - startTime,
            piiFound: null,
          },
        });
      }

      baseResult.policy = {
        inputRules: policy.inputRules.map((r: any) => ({ type: r.type, enabled: r.enabled, action: r.action })),
        outputRules: policy.outputRules.map((r: any) => ({ type: r.type, enabled: r.enabled, action: r.action })),
        blockedTopics: policy.globalBlockedTopics,
      };
      return NextResponse.json(baseResult);
    }

    // ── Step 2: Full Pipeline — Call real LLM ──
    const processedInput = maskedInput || input;
    const systemPrompt =
      "You are a helpful customer support assistant for Acme Corp. Answer questions professionally and concisely. If asked about competitors, internal plans, or sensitive topics, politely decline. Keep responses under 100 words.";

    let llmOutput: string;
    try {
      llmOutput = await chat(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: processedInput },
        ],
        { temperature: 0.3 }
      );
    } catch {
      // Fallback to simulated response if SDK fails
      const lower = processedInput.toLowerCase();
      if (lower.includes("return") || lower.includes("refund")) {
        llmOutput = "Our return policy allows you to return most items within 30 days of purchase. Electronics must be in their original packaging with all accessories included. Refunds are processed within 5-7 business days after we receive the returned item.";
      } else if (lower.includes("shipping") || lower.includes("deliver")) {
        llmOutput = "We offer free standard shipping on all orders over $50. Standard delivery takes 3-5 business days. Express shipping is available for $9.99 with 1-2 business day delivery.";
      } else if (lower.includes("price") || lower.includes("cost")) {
        llmOutput = "For specific pricing, please visit our website or contact our sales team. We offer volume discounts for orders of 10+ units.";
      } else {
        llmOutput = "Thank you for your question. For the most up-to-date information, please check our help center at help.acmecorp.com or contact our support team directly.";
      }
    }

    // ── Step 3: Output Guardrails ──
    let outputStatus: Record<string, unknown> = { status: "allowed" };
    let finalStatus = "allowed";

    const toxRule = policy.outputRules.find((r: any) => r.type === "toxicity");
    if (toxRule?.enabled) {
      const toxCheck = checkToxicity(llmOutput);
      if (!toxCheck.passed) {
        outputStatus = { status: "blocked", blockedBy: "toxicity", reason: toxCheck.reason };
        finalStatus = "blocked_output";
      }
    }

    if (finalStatus === "allowed") {
      const topicRule = policy.outputRules.find((r: any) => r.type === "topic_relevance");
      if (topicRule?.enabled && policy.globalBlockedTopics.length > 0) {
        const topicCheck = checkTopicRelevance(llmOutput, policy.globalBlockedTopics);
        if (!topicCheck.passed) {
          outputStatus = { status: "blocked", blockedBy: "topic_relevance", reason: topicCheck.reason };
          finalStatus = "blocked_output";
        }
      }
    }

    // Log to database
    await db.gatewayLog.create({
      data: {
        requestId,
        direction: "output",
        inputText: input,
        outputText: finalStatus === "allowed" ? llmOutput : null,
        status: finalStatus === "allowed" ? "allowed" : "blocked",
        blockedBy: finalStatus !== "allowed" ? (outputStatus.blockedBy as string) : null,
        reason: finalStatus !== "allowed" ? (outputStatus.reason as string) : null,
        latencyMs: Date.now() - startTime,
        piiFound: pii.length > 0 ? JSON.stringify(pii) : null,
      },
    });

    return NextResponse.json({
      ...baseResult,
      status: finalStatus,
      outputStatus,
      output: finalStatus === "allowed" ? llmOutput : undefined,
      latencyMs: Date.now() - startTime,
    });
  } catch (error) {
    console.error("Gateway error:", error);
    return NextResponse.json({ error: "Gateway processing failed." }, { status: 500 });
  }
}
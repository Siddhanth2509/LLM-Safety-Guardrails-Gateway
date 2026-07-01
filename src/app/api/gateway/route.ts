import { NextRequest, NextResponse } from "next/server";
import { detectPII, maskPII } from "@/lib/guardrails/pii";
import { detectInjectionPatterns } from "@/lib/guardrails/injection";
import { getPolicy } from "@/lib/guardrails/policy";

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
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

    // Input guardrails
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

    const result: Record<string, unknown> = {
      requestId,
      status: inputStatus === "blocked" ? "blocked_input" : inputStatus === "modified" ? "modified" : "allowed",
      inputStatus: { status: inputStatus, pii, injection, maskedInput, blockedBy, reason },
      originalInput: input,
      processedInput: maskedInput || input,
      latencyMs: Date.now() - startTime,
    };

    if (dryRun) {
      result.policy = {
        inputRules: policy.inputRules.map((r: any) => ({ type: r.type, enabled: r.enabled, action: r.action })),
        outputRules: policy.outputRules.map((r: any) => ({ type: r.type, enabled: r.enabled, action: r.action })),
        blockedTopics: policy.globalBlockedTopics,
      };
      return NextResponse.json(result);
    }

    // Full pipeline (simulated LLM output)
    const processedInput = maskedInput || input;
    const lower = processedInput.toLowerCase();
    let llmOutput: string;
    if (lower.includes("return") || lower.includes("refund")) {
      llmOutput = "Our return policy allows you to return most items within 30 days of purchase. Electronics must be in their original packaging with all accessories included. Refunds are processed within 5-7 business days after we receive the returned item.";
    } else if (lower.includes("shipping") || lower.includes("deliver")) {
      llmOutput = "We offer free standard shipping on all orders over $50. Standard delivery takes 3-5 business days. Express shipping is available for $9.99 with 1-2 business day delivery.";
    } else if (lower.includes("price") || lower.includes("cost")) {
      llmOutput = "For specific pricing, please visit our website or contact our sales team at sales@acmecorp.com. We offer volume discounts for orders of 10+ units.";
    } else {
      llmOutput = "Thank you for your question. For the most up-to-date information, please check our help center at help.acmecorp.com or contact our support team directly. Is there anything else I can assist you with?";
    }

    result.output = llmOutput;
    result.outputStatus = { status: "allowed" };
    result.status = "allowed";

    return NextResponse.json(result);
  } catch (error) {
    console.error("Gateway error:", error);
    return NextResponse.json({ error: "Gateway processing failed." }, { status: 500 });
  }
}
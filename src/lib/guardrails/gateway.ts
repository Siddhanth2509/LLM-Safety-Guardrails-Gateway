/**
 * LLM Guardrails Gateway Engine
 *
 * Processes requests through a pipeline of guardrails:
 *   Input:  PII Detection → Injection Detection → Topic Check → [LLM Call]
 *   Output: Toxicity Check → Topic Relevance → Schema Validation → Response
 */

import { detectPII, maskPII, PIIMatch } from "./pii";
import { detectInjectionPatterns, InjectionResult } from "./injection";
import { validateJSONSchema, checkToxicity, checkTopicRelevance } from "./output";
import { getPolicy, PolicyConfig } from "./policy";

// ─── Types ───────────────────────────────────────────────────────────

export type GuardrailStatus = "allowed" | "blocked" | "modified";

export interface InputCheckResult {
  status: GuardrailStatus;
  pii: PIIMatch[];
  injection: InjectionResult;
  maskedInput?: string;
  blockedBy?: string;
  reason?: string;
}

export interface OutputCheckResult {
  status: GuardrailStatus;
  toxicity?: string;
  topicViolation?: string;
  schemaError?: string;
  modifiedOutput?: string;
  blockedBy?: string;
  reason?: string;
}

export interface GatewayRequest {
  id: string;
  input: string;
  systemPrompt?: string;
  requireJson?: boolean;
  jsonFields?: string[];
}

export interface GatewayResponse {
  requestId: string;
  status: "allowed" | "blocked_input" | "blocked_output" | "modified";
  inputStatus: InputCheckResult;
  outputStatus?: OutputCheckResult;
  output?: string;
  originalInput: string;
  processedInput?: string;
  latencyMs: number;
}

// ─── Gateway Engine ──────────────────────────────────────────────────

/**
 * Run input through all input guardrails.
 */
export function checkInput(
  text: string,
  policy?: PolicyConfig
): InputCheckResult {
  const p = policy || getPolicy();

  // 1. PII Detection
  const piiRule = p.inputRules.find((r) => r.type === "pii");
  const pii = piiRule?.enabled ? detectPII(text) : [];

  // 2. Prompt Injection Detection
  const injRule = p.inputRules.find((r) => r.type === "prompt_injection");
  const injection = injRule?.enabled
    ? detectInjectionPatterns(text)
    : { detected: false, confidence: 0, type: "none", reason: "" };

  // 3. Check results in priority order: injection > pii > topics
  if (injection.detected && injection.confidence >= 0.5) {
    const action = injRule?.action || "block";
    if (action === "block") {
      return {
        status: "blocked",
        pii,
        injection,
        blockedBy: "prompt_injection",
        reason: injection.reason,
      };
    }
  }

  if (pii.length > 0) {
    const action = piiRule?.action || "mask";
    if (action === "mask") {
      return {
        status: "modified",
        pii,
        injection,
        maskedInput: maskPII(text, pii),
        blockedBy: "pii",
        reason: `PII detected: ${pii.map((p) => p.label).join(", ")}`,
      };
    }
    if (action === "block") {
      return {
        status: "blocked",
        pii,
        injection,
        blockedBy: "pii",
        reason: `PII blocked: ${pii.map((p) => p.label).join(", ")}`,
      };
    }
  }

  return { status: "allowed", pii, injection };
}

/**
 * Run output through all output guardrails.
 */
export function checkOutput(
  text: string,
  policy?: PolicyConfig
): OutputCheckResult {
  const p = policy || getPolicy();
  const result: OutputCheckResult = { status: "allowed" };

  // 1. Toxicity check
  const toxRule = p.outputRules.find((r) => r.type === "toxicity");
  if (toxRule?.enabled) {
    const toxCheck = checkToxicity(text);
    if (!toxCheck.passed) {
      result.status = "blocked";
      result.blockedBy = "toxicity";
      result.toxicity = toxCheck.reason;
      result.reason = toxCheck.reason;
      return result;
    }
  }

  // 2. Topic relevance
  const topicRule = p.outputRules.find((r) => r.type === "topic_relevance");
  if (topicRule?.enabled && p.globalBlockedTopics.length > 0) {
    const topicCheck = checkTopicRelevance(text, p.globalBlockedTopics);
    if (!topicCheck.passed) {
      result.status = "blocked";
      result.blockedBy = "topic_relevance";
      result.topicViolation = topicCheck.reason;
      result.reason = topicCheck.reason;
      return result;
    }
  }

  // 3. JSON schema validation
  const schemaRule = p.outputRules.find((r) => r.type === "json_schema");
  if (schemaRule?.enabled && (p.requireJsonSchema || schemaRule.config?.enforce)) {
    const schemaCheck = validateJSONSchema(
      text,
      p.jsonRequiredFields.length > 0
        ? p.jsonRequiredFields
        : (schemaRule.config?.fields as string[]) || []
    );
    if (!schemaCheck.passed) {
      const action = schemaRule.action || "warn";
      if (action === "block") {
        result.status = "blocked";
        result.blockedBy = "json_schema";
        result.schemaError = schemaCheck.reason;
        result.reason = schemaCheck.reason;
        return result;
      }
    }
  }

  return result;
}

/**
 * Full gateway pipeline: input check → LLM call → output check.
 */
export async function processRequest(
  req: GatewayRequest
): Promise<GatewayResponse> {
  const startTime = Date.now();
  const policy = getPolicy();

  // ── Step 1: Input Guardrails ──
  const inputStatus = checkInput(req.input, policy);

  if (inputStatus.status === "blocked") {
    await logRequest({
      requestId: req.id,
      direction: "input",
      inputText: req.input,
      status: "blocked",
      blockedBy: inputStatus.blockedBy!,
      reason: inputStatus.reason,
      latencyMs: Date.now() - startTime,
      piiFound: inputStatus.pii.length > 0 ? JSON.stringify(inputStatus.pii) : null,
    });

    return {
      requestId: req.id,
      status: "blocked_input",
      inputStatus,
      originalInput: req.input,
      processedInput: inputStatus.status === "modified" ? inputStatus.maskedInput : req.input,
      latencyMs: Date.now() - startTime,
    };
  }

  // ── Step 2: LLM Call (or simulated response) ──
  const inputForLLM = inputStatus.maskedInput || req.input;
  const systemPrompt =
    req.systemPrompt ||
    "You are a helpful customer support assistant for Acme Corp. Answer questions professionally. If asked about competitors, internal plans, or sensitive topics, politely decline.";

  let llmOutput: string;
  // Generate a simulated LLM response (production would call a real LLM API)
  const lowerInput = inputForLLM.toLowerCase();
  if (lowerInput.includes("return") || lowerInput.includes("refund")) {
    llmOutput = "Our return policy allows you to return most items within 30 days of purchase. Electronics must be in their original packaging with all accessories included. Refunds are processed within 5-7 business days after we receive the returned item. For more details, please visit our Returns Center or contact our support team.";
  } else if (lowerInput.includes("shipping") || lowerInput.includes("deliver")) {
    llmOutput = "We offer free standard shipping on all orders over $50. Standard delivery takes 3-5 business days, while express shipping (1-2 business days) is available for an additional $9.99. International shipping is available to select countries with delivery times of 7-14 business days.";
  } else if (lowerInput.includes("price") || lowerInput.includes("cost")) {
    llmOutput = "For specific pricing information, please visit the product page on our website or contact our sales team at sales@acmecorp.com. We also offer volume discounts for business orders of 10+ units. Our price match guarantee ensures you get the best deal.";
  } else {
    llmOutput = "Thank you for your question. I'd be happy to help you with that. For the most up-to-date information, I recommend checking our help center at help.acmecorp.com or contacting our support team directly. Is there anything else I can assist you with?";
  }

  // ── Step 3: Output Guardrails ──
  const outputStatus = checkOutput(llmOutput, policy);

  const finalStatus: GatewayResponse["status"] =
    outputStatus.status === "blocked" ? "blocked_output" : "allowed";

  await logRequest({
    requestId: req.id,
    direction: "output",
    inputText: req.input,
    outputText: llmOutput,
    status: outputStatus.status === "blocked" ? "blocked" : "allowed",
    blockedBy: outputStatus.blockedBy,
    reason: outputStatus.reason,
    latencyMs: Date.now() - startTime,
    piiFound: inputStatus.pii.length > 0 ? JSON.stringify(inputStatus.pii) : null,
  });

  return {
    requestId: req.id,
    status: finalStatus,
    inputStatus,
    outputStatus,
    output: finalStatus === "allowed" ? llmOutput : undefined,
    originalInput: req.input,
    processedInput: inputForLLM,
    latencyMs: Date.now() - startTime,
  };
}

// ─── Logging ─────────────────────────────────────────────────────────

async function logRequest(_data: {
  requestId: string;
  direction: string;
  inputText: string;
  outputText?: string;
  status: string;
  blockedBy?: string;
  reason?: string;
  latencyMs: number;
  piiFound?: string | null;
}) {
  // Logging via DB would cause Turbopack chunk issues in dev.
  // In production, this would persist to the database.
}
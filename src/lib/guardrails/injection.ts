/**
 * Prompt Injection Detection
 * Multi-layer detection: pattern matching + LLM-based analysis.
 */

export interface InjectionResult {
  detected: boolean;
  confidence: number;
  type: string;
  reason: string;
}

// Known injection patterns (layer 1: fast regex)
const INJECTION_PATTERNS: { type: string; pattern: RegExp; reason: string }[] = [
  {
    type: "role_hijack",
    pattern: /ignore (all )?(previous|above) (instructions?|prompts?|rules?)/i,
    reason: "Attempt to ignore system instructions",
  },
  {
    type: "role_hijack",
    pattern: /you are (now|no longer|a) (?:a |an )?(?:helpful|evil|jailbroken|unrestricted| DAN)/i,
    reason: "Attempt to override system role",
  },
  {
    type: "role_hijack",
    pattern: /forget (everything|all|your instructions|your rules)/i,
    reason: "Attempt to reset system context",
  },
  {
    type: "system_prompt_leak",
    pattern: /(?:reveal|show|print|display|output|repeat|tell me) (?:your |the )?(?:system |initial |original )?(?:prompt|instructions?|rules?)/i,
    reason: "Attempt to extract system prompt",
  },
  {
    type: "system_prompt_leak",
    pattern: /\{[\s\S]*?system[\s\S]*?prompt[\s\S]*?\}/i,
    reason: "Possible system prompt extraction via template",
  },
  {
    type: "delimiter_attack",
    pattern: /(?:```\s*system|<\|im_start\|>system|\[SYSTEM\])/i,
    reason: "Attempt to inject system-level delimiter",
  },
  {
    type: "jailbreak",
    pattern: /(?:jailbreak|jail.?break|DAN|do anything now)/i,
    reason: "Known jailbreak technique detected",
  },
  {
    type: "encoding_bypass",
    pattern: /(?:base64|rot13|unicode|url.?encod|html.?entit)/i,
    reason: "Possible encoding-based bypass attempt",
  },
  {
    type: "multi_turn_attack",
    pattern: /(?:step\s*\d+\s*[:.]|act\s+as\s+if|pretend\s+you)/i,
    reason: "Multi-turn manipulation pattern detected",
  },
  {
    type: "indirect_injection",
    pattern: /(?:read the (?:following|below) (?:text|data|content)|process this (?:document|file|data))/i,
    reason: "Possible indirect prompt injection via data",
  },
];

/**
 * Fast pattern-based injection detection (no LLM call needed).
 */
export function detectInjectionPatterns(text: string): InjectionResult {
  const detected: typeof INJECTION_PATTERNS = [];

  for (const rule of INJECTION_PATTERNS) {
    if (rule.pattern.test(text)) {
      detected.push(rule);
    }
  }

  if (detected.length === 0) {
    return { detected: false, confidence: 0, type: "none", reason: "" };
  }

  // Confidence scales with number of distinct attack types
  const uniqueTypes = new Set(detected.map((d) => d.type)).size;
  const confidence = Math.min(0.95, 0.5 + uniqueTypes * 0.15);

  return {
    detected: true,
    confidence,
    type: detected[0].type,
    reason: detected.map((d) => d.reason).join("; "),
  };
}
/**
 * Output Guardrails
 * Validates LLM output for schema compliance and content safety.
 */

export interface ValidationResult {
  passed: boolean;
  reason?: string;
  modifiedOutput?: string;
}

/**
 * Check if output is valid JSON matching expected schema.
 */
export function validateJSONSchema(
  output: string,
  requiredFields: string[] = []
): ValidationResult {
  try {
    const parsed = JSON.parse(output);

    if (!requiredFields || requiredFields.length === 0) {
      return { passed: true };
    }

    const missing = requiredFields.filter(
      (field) => !(field in parsed) || parsed[field] === null || parsed[field] === undefined
    );

    if (missing.length > 0) {
      return {
        passed: false,
        reason: `Missing required fields: ${missing.join(", ")}`,
      };
    }

    return { passed: true };
  } catch {
    return {
      passed: false,
      reason: "Output is not valid JSON",
    };
  }
}

/**
 * Check output for toxic/harmful content using pattern matching.
 */
export function checkToxicity(output: string): ValidationResult {
  const toxicPatterns = [
    { pattern: /i(?:'m| am) (?:going to|planning to|about to) (?:kill|hurt|harm|attack)/i, reason: "Violent intent expression" },
    { pattern: /(?:how to|instructions? to|step.?by.?step to) (?:make|create|build|cook) (?:a )?(?:bomb|weapon|drug|poison|meth)/i, reason: "Harmful content generation request" },
    { pattern: /i(?:'m| am) (?:an? )?(?:nazi|racist|supremacist|white nationalist)/i, reason: "Hate speech self-identification" },
    { pattern: /(?:all \w+ (?:should|must|deserve to|need to) (?:die|be killed|be eliminated))/i, reason: "Genocidal language" },
  ];

  for (const { pattern, reason } of toxicPatterns) {
    if (pattern.test(output)) {
      return { passed: false, reason };
    }
  }

  return { passed: true };
}

/**
 * Enforce topic relevance — check output stays on topic.
 */
export function checkTopicRelevance(
  output: string,
  blockedTopics: string[]
): ValidationResult {
  for (const topic of blockedTopics) {
    // Case-insensitive word boundary match
    const regex = new RegExp(`\\b${topic}\\b`, "i");
    if (regex.test(output)) {
      return {
        passed: false,
        reason: `Output discusses blocked topic: "${topic}"`,
      };
    }
  }

  return { passed: true };
}
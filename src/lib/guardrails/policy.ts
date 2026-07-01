/**
 * Policy Engine
 * Configurable rules that non-engineers can define.
 */

export interface PolicyConfig {
  inputRules: InputPolicy[];
  outputRules: OutputPolicy[];
  globalBlockedTopics: string[];
  requireJsonSchema: boolean;
  jsonRequiredFields: string[];
}

export interface InputPolicy {
  type: "pii" | "prompt_injection" | "topic_block";
  enabled: boolean;
  action: "block" | "mask" | "warn"; // what to do when triggered
  config?: Record<string, unknown>;
}

export interface OutputPolicy {
  type: "json_schema" | "toxicity" | "topic_relevance";
  enabled: boolean;
  action: "block" | "retry" | "warn";
  config?: Record<string, unknown>;
}

export const DEFAULT_POLICY: PolicyConfig = {
  inputRules: [
    { type: "pii", enabled: true, action: "mask" },
    { type: "prompt_injection", enabled: true, action: "block" },
    { type: "topic_block", enabled: true, action: "block" },
  ],
  outputRules: [
    { type: "toxicity", enabled: true, action: "block" },
    { type: "topic_relevance", enabled: true, action: "block" },
    { type: "json_schema", enabled: false, action: "warn" },
  ],
  globalBlockedTopics: [
    "competitor pricing",
    "internal roadmaps",
    "unreleased products",
    "employee salaries",
    "legal proceedings",
  ],
  requireJsonSchema: false,
  jsonRequiredFields: [],
};

/**
 * Load policy from database or fall back to default.
 */
export function getPolicy(): PolicyConfig {
  return DEFAULT_POLICY;
}
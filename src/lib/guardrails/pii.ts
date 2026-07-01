/**
 * PII Detection Module
 * Detects and masks personally identifiable information using regex + pattern matching.
 */

export interface PIIMatch {
  type: string;
  value: string;
  start: number;
  end: number;
  label: string;
}

const PATTERNS: { type: string; label: string; pattern: RegExp }[] = [
  {
    type: "credit_card",
    label: "Credit Card Number",
    pattern: /\b(?:\d[ -]*?){13,19}\b/g,
  },
  {
    type: "ssn",
    label: "Social Security Number",
    pattern: /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/g,
  },
  {
    type: "email",
    label: "Email Address",
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  },
  {
    type: "phone",
    label: "Phone Number",
    pattern: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  },
  {
    type: "api_key",
    label: "API Key",
    pattern: /\b(sk|pk|api_key|apikey|secret|token)[_-][A-Za-z0-9_-]{20,}\b/gi,
  },
  {
    type: "aws_key",
    label: "AWS Access Key",
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
  },
  {
    type: "bitcoin",
    label: "Bitcoin Address",
    pattern: /\b(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}\b/g,
  },
  {
    type: "ip_address",
    label: "IP Address",
    pattern: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
  },
];

/**
 * Detect PII in text and return matches with positions.
 */
export function detectPII(text: string): PIIMatch[] {
  const matches: PIIMatch[] = [];

  for (const { type, label, pattern } of PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      // Filter out obvious false positives
      const val = match[0].trim();
      if (type === "credit_card" && val.replace(/\D/g, "").length < 13) continue;
      if (type === "phone" && val.replace(/\D/g, "").length < 10) continue;

      matches.push({
        type,
        label,
        value: val,
        start: match.index,
        end: match.index + val.length,
      });
    }
  }

  return matches;
}

/**
 * Mask PII in text, replacing detected values with [TYPE].
 */
export function maskPII(text: string, pii: PIIMatch[]): string {
  if (pii.length === 0) return text;

  // Sort by start position descending to replace from end
  const sorted = [...pii].sort((a, b) => b.start - a.start);
  let result = text;

  for (const match of sorted) {
    const mask = `[${match.label}]`;
    result = result.slice(0, match.start) + mask + result.slice(match.end);
  }

  return result;
}
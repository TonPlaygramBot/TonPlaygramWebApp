const BLOCK_PATTERNS = [
  /api[\s_-]?keys?/i,
  /secret/i,
  /token/i,
  /private key/i,
  /dump database/i,
  /show (code|stack trace|logs)/i,
  /bypass|exploit|hack|dupe/i,
  /admin tool|internal note/i
];

const PII_PATTERNS = [
  /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/, // us ssn-like
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /\b(?:\d[ -]*?){13,16}\b/
];

export interface SafetyResult {
  allowed: boolean;
  reason?: string;
  redactedOutput?: string;
}

export function evaluateUserPrompt(prompt: string): SafetyResult {
  if (BLOCK_PATTERNS.some((pattern) => pattern.test(prompt))) {
    return {
      allowed: false,
      reason:
        'I can’t help with sensitive, private, or abuse-enabling requests. I can share public user help and official support steps instead.'
    };
  }

  return { allowed: true };
}

export function redactSensitive(output: string): string {
  let safeText = output;
  PII_PATTERNS.forEach((pattern) => {
    safeText = safeText.replace(pattern, '[redacted]');
  });
  return safeText;
}

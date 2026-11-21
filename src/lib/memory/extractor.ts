/**
 * Autonomous Memory & Fact Extractor for Astor.
 * Analyzes user messages for personal facts, technical preferences,
 * stack choices, and explicit "remember that" cues.
 */

export interface ExtractedFact {
  fact: string;
  category: 'identity' | 'project' | 'preference' | 'workflow' | 'general';
}

const EXPLICIT_REMEMBER_REGEX =
  /(?:please\s+)?remember\s+(?:that\s+|to\s+|:\s*)?(.+)/i;

const NAME_REGEX =
  /\b(?:my\s+name\s+is|call\s+me)\s+([A-Za-z]+)\b/i;

const ROLE_REGEX =
  /\b(?:i\s+work\s+as\s+(?:a|an)?|i\s+am\s+(?:a|an)?|i'm\s+(?:a|an)?)\s+([a-zA-Z\s]+(?:developer|engineer|designer|manager|student|founder|researcher|architect|consultant|analyst))\b/i;

const WORKPLACE_REGEX =
  /\b(?:i\s+work\s+at|i'm\s+at|employed\s+at)\s+([A-Z][\w\s\.\-]+)/i;

const LOCATION_REGEX =
  /\b(?:i\s+(?:live|reside|am\s+based)\s+in|based\s+out\s+of)\s+([A-Z][a-zA-Z\s,]+)\b/i;

const PROJECT_REGEX =
  /\b(?:i(?:'m|\s+am)\s+(?:building|working\s+on|creating|developing)|my\s+project\s+is(?:\s+called)?|my\s+app\s+is(?:\s+called)?)\s+([a-zA-Z0-9\s\-_]+?)(?:\s+(?:and\s+our|with|using|in\s+our|\.|\,)|$)/i;

const STACK_REGEX =
  /\b(?:(?:my\s+)?(?:tech\s+)?stack\s+is|we\s+use|i\s+use)\s+([a-zA-Z0-9\s,\.\-_]+?(?:next\.?js|react|vue|node|python|typescript|golang|rust|postgres|mongodb|fastapi|django|tailwind)[\w\s,]*)/i;

const PREFERENCE_REGEX =
  /\b(?:i\s+prefer|i\s+always\s+prefer|always\s+use|never\s+use|i\s+like\s+my\s+code|prefer\s+code\s+in)\s+([^.,\n]+)/i;

/**
 * Extracts facts from a user message.
 */
export function extractUserFacts(text: string): ExtractedFact[] {
  if (!text || text.trim().length < 5) return [];

  const trimmed = text.trim();
  const facts: ExtractedFact[] = [];

  // 1. Explicit Remember instruction (highest precedence)
  const explicitMatch = trimmed.match(EXPLICIT_REMEMBER_REGEX);
  if (explicitMatch && explicitMatch[1]) {
    const rawFact = explicitMatch[1].trim().replace(/^that\s+/i, '');
    if (rawFact.length >= 3 && rawFact.length <= 300) {
      facts.push({
        fact: rawFact.charAt(0).toUpperCase() + rawFact.slice(1),
        category: 'preference',
      });
      return facts; // If explicit instruction given, focus on it
    }
  }

  // 2. Identity / Name
  const nameMatch = trimmed.match(NAME_REGEX);
  if (nameMatch && nameMatch[1]) {
    const name = nameMatch[1].trim();
    if (name.length > 1 && !['a', 'an', 'the', 'not', 'just'].includes(name.toLowerCase())) {
      facts.push({
        fact: `User's name is ${name}`,
        category: 'identity',
      });
    }
  }

  // 3. Role / Profession
  const roleMatch = trimmed.match(ROLE_REGEX);
  if (roleMatch && roleMatch[1]) {
    const role = roleMatch[1].trim();
    if (role.length > 3) {
      facts.push({
        fact: `User works as ${role}`,
        category: 'identity',
      });
    }
  }

  // 4. Workplace
  const workMatch = trimmed.match(WORKPLACE_REGEX);
  if (workMatch && workMatch[1]) {
    const company = workMatch[1].trim();
    if (company.length > 2 && company.length < 50) {
      facts.push({
        fact: `User works at ${company}`,
        category: 'identity',
      });
    }
  }

  // 5. Location
  const locMatch = trimmed.match(LOCATION_REGEX);
  if (locMatch && locMatch[1]) {
    const loc = locMatch[1].trim();
    if (loc.length > 2 && loc.length < 60) {
      facts.push({
        fact: `User is based in ${loc}`,
        category: 'general',
      });
    }
  }

  // 6. Project
  const projMatch = trimmed.match(PROJECT_REGEX);
  if (projMatch && projMatch[1]) {
    const project = projMatch[1].trim();
    if (project.length > 3 && project.length < 120) {
      facts.push({
        fact: `User is working on ${project}`,
        category: 'project',
      });
    }
  }

  // 7. Tech Stack
  const stackMatch = trimmed.match(STACK_REGEX);
  if (stackMatch && stackMatch[1]) {
    const stack = stackMatch[1].trim();
    if (stack.length > 3 && stack.length < 140) {
      facts.push({
        fact: `User's stack includes ${stack}`,
        category: 'workflow',
      });
    }
  }

  // 8. General Preferences
  const prefMatch = trimmed.match(PREFERENCE_REGEX);
  if (prefMatch && prefMatch[1]) {
    const pref = prefMatch[1].trim();
    if (pref.length > 3 && pref.length < 150) {
      facts.push({
        fact: `User preference: ${pref}`,
        category: 'preference',
      });
    }
  }

  return facts;
}

/**
 * Checks if a candidate fact is already known to prevent duplicate memories.
 */
export function isDuplicateMemory(candidate: string, existingFacts: string[]): boolean {
  const normCandidate = candidate.toLowerCase().replace(/[^\w\s]/g, '').trim();
  for (const existing of existingFacts) {
    const normExisting = existing.toLowerCase().replace(/[^\w\s]/g, '').trim();
    if (normCandidate === normExisting) return true;
    if (normExisting.includes(normCandidate) || normCandidate.includes(normExisting)) {
      return true;
    }
  }
  return false;
}

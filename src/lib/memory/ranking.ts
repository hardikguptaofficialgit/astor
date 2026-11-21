import { UserMemoryItem } from './log';

export interface RankedMemoryResult {
  topMemories: UserMemoryItem[];
  contextXml: string;
}

const MEMORY_INQUIRY_REGEX =
  /\b(?:what\s+(?:do\s+you\s+know|do\s+you\s+remember|have\s+you\s+remembered|memories\s+do\s+you\s+have)\s+about\s+me|who\s+am\s+i|what\s+are\s+my\s+(?:preferences|details|facts|projects|stack)|list\s+(?:my\s+)?memories|show\s+(?:my\s+)?memories)\b/i;

/**
 * Ranks and formats user memories relevant to the current conversation turn.
 */
export function rankUserMemories(
  memories: UserMemoryItem[],
  query: string,
  userProfile?: {
    name?: string;
    profession?: string;
    customInstructions?: string;
  }
): RankedMemoryResult {
  if ((!memories || memories.length === 0) && !userProfile) {
    return { topMemories: [], contextXml: '' };
  }

  const isMemoryInquiry = MEMORY_INQUIRY_REGEX.test(query || '');

  // Extract query keywords (ignoring small stop words)
  const queryTerms = (query || '')
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 2 && !['the', 'and', 'for', 'with', 'what', 'how', 'why', 'can'].includes(w));

  const scored = (memories || []).map((m) => {
    let score = 0;
    const factLower = m.fact.toLowerCase();

    if (isMemoryInquiry) {
      score += 100;
    } else {
      // Keyword match
      for (const term of queryTerms) {
        if (factLower.includes(term)) {
          score += 6;
        }
      }

      // Preference or onboarding facts always get baseline boost
      if (m.category === 'preference' || m.category === 'identity' || m.category === 'onboarding') {
        score += 3;
      }

      // Tech stack boost when query has code words
      if (
        (m.category === 'workflow' || m.category === 'project') &&
        queryTerms.some((t) => ['code', 'build', 'stack', 'app', 'deploy', 'api', 'db', 'data'].includes(t))
      ) {
        score += 4;
      }
    }

    return { memory: m, score };
  });

  // Sort descending by score, then by recency
  scored.sort((a, b) => b.score - a.score || b.memory.created_at - a.memory.created_at);

  // Take top 8 most relevant memories (or up to 25 if asking directly about memory)
  const limit = isMemoryInquiry ? 25 : 8;
  const top = scored.slice(0, limit).map((s) => s.memory);

  // Build clean context string
  const lines: string[] = [];

  if (userProfile?.name) {
    lines.push(`User Name: ${userProfile.name}`);
  }
  if (userProfile?.profession) {
    lines.push(`User Profession / Role: ${userProfile.profession}`);
  }
  if (userProfile?.customInstructions) {
    lines.push(`User Custom Prompt:\n${userProfile.customInstructions}`);
  }

  if (top.length > 0) {
    lines.push(`Active Remembered Facts:\n${top.map((m) => `- ${m.fact}`).join('\n')}`);
  }

  if (isMemoryInquiry && top.length > 0) {
    lines.push(
      `Guidance: The user is asking about what you remember about them. Summarize all known facts affectionately, accurately, and mention that they can view or edit these in Settings > Memory.`
    );
  }

  return {
    topMemories: top,
    contextXml: lines.join('\n\n'),
  };
}

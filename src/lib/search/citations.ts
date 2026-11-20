/**
 * Citation extraction and validation.
 * Ensures every [n] reference in the model's output corresponds to a verified search source.
 */

export interface CitationValidationResult {
  validatedText: string;
  foundCitations: number[];
  validCitations: number[];
  invalidCitations: number[];
}

/**
 * Extracts all numeric citations [n] from markdown text.
 */
export function extractCitations(text: string): number[] {
  const matches = text.matchAll(/\[(\d+)\]/g);
  const numbers: number[] = [];
  for (const m of matches) {
    const num = parseInt(m[1], 10);
    if (!isNaN(num) && !numbers.includes(num)) {
      numbers.push(num);
    }
  }
  return numbers.sort((a, b) => a - b);
}

/**
 * Validates citations against available source numbers.
 * Unknown / hallucinated citations (not present in validSourceNumbers) are stripped from the output text.
 */
export function validateCitations(
  text: string,
  validSourceNumbers: number[] | Set<number>
): CitationValidationResult {
  const validSet = validSourceNumbers instanceof Set ? validSourceNumbers : new Set(validSourceNumbers);
  const found = extractCitations(text);
  const validCitations: number[] = [];
  const invalidCitations: number[] = [];

  for (const n of found) {
    if (validSet.has(n)) {
      validCitations.push(n);
    } else {
      invalidCitations.push(n);
    }
  }

  // Strip unknown citations from text: e.g. "[9]" -> ""
  let validatedText = text;
  if (invalidCitations.length > 0) {
    for (const invalid of invalidCitations) {
      // Replace "[invalid]" globally, cleaning up any double spaces that result
      const regex = new RegExp(`\\[${invalid}\\]`, 'g');
      validatedText = validatedText.replace(regex, '');
    }
    // Clean up resulting double spaces before punctuation
    validatedText = validatedText.replace(/ +([.,;:!?])/g, '$1').replace(/ {2,}/g, ' ');
  }

  return {
    validatedText,
    foundCitations: found,
    validCitations,
    invalidCitations,
  };
}

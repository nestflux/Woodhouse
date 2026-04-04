import { type ReactNode } from "react";

/**
 * Matches common AI-generated metric placeholders:
 *   ~X%, ~$X, ~X, ~Xk, ~X+, [X], [X%], [number], [specific metric]
 * These appear when the AI suggests adding metrics the user should fill in.
 */
const PLACEHOLDER_RE =
  /~\$?\d+[%kKmMbB+]?|~X[%kKmMbB+]?|\[(?:X%?|number|specific [\w ]+?|insert [\w ]+?|your [\w ]+?)\]/gi;

/**
 * Split text on placeholder patterns and wrap matches in red highlights.
 * Returns the original string if no placeholders are found.
 */
export function highlightPlaceholders(text: string): ReactNode {
  if (!PLACEHOLDER_RE.test(text)) return text;

  // Reset lastIndex after test()
  PLACEHOLDER_RE.lastIndex = 0;

  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = PLACEHOLDER_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <span
        key={key++}
        className="rounded bg-[#dc2626]/10 px-0.5 font-medium text-[#dc2626]"
      >
        {match[0]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

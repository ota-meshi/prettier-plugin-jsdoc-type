import type { PunctuatorToken } from "../ast.js";
import type { ParserState } from "../parser-state.js";

export function parseDelimitedList<E>(
  state: ParserState,
  closeValue: "}" | "]" | ")" | ">",
  parseElement: (state: ParserState) => E | null,
): { elements: E[]; close: PunctuatorToken } | null {
  const elements: E[] = [];
  do {
    const close = state.eatValue(closeValue);
    if (close) return { elements, close };
    const element = state.tryParse(parseElement);
    if (!element) return null;
    elements.push(element);
  } while (state.eatValue(","));
  const close = state.eatValue(closeValue);
  return close && { elements, close };
}

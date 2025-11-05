import type { JsdocIdentifier, JsdocTSThisType } from "../ast.js";
import { identifier } from "../node.js";
import type { ParserState } from "../parser-state.js";

export function parseIdentifier(
  state: ParserState,
): JsdocIdentifier | JsdocTSThisType | null {
  const identifierToken = state.eat("Identifier");
  if (!identifierToken) return null;
  if (identifierToken.value === "this") {
    return {
      type: "TSThisType",
      loc: {
        start: identifierToken.loc.start,
        end: identifierToken.loc.end,
      },
    };
  }
  return identifier(identifierToken);
}

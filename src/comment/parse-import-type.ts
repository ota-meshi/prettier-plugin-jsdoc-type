import type { JsdocImportTagType } from "./ast.js";
import type { Lines } from "./lines.js";
import { ParserState } from "./parser-state.js";
import { parseImportType } from "./parsers/import-type.js";
import { Tokenizer } from "./tokenizer.js";

export function parseImportTagType(lines: Lines): JsdocImportTagType | null {
  const tokenizer = new Tokenizer(lines);
  const state = new ParserState(tokenizer);
  const parsed = parseImportType(state);
  if (!parsed) return null;

  const node: JsdocImportTagType = {
    type: "JsdocImportTagType",
    specifiers: parsed.specifiers,
    source: parsed.source,
    attributes: parsed.attributes?.elements || [],
    tokens: [],
    loc: {
      start: state.tokens[0].loc.start,
      end: parsed.attributes
        ? parsed.attributes.close.loc.end
        : parsed.source.loc.end,
    },
  };

  const semi = state.eatValue(";");
  if (semi) {
    node.loc.end = semi.loc.end;
  }

  node.tokens.push(...state.tokens);
  return node;
}

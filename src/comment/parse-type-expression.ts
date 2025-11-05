import type { JsdocTypeExpression } from "./ast.js";
import type { Lines } from "./lines.js";
import { ParserState } from "./parser-state.js";
import { parseTypeAnnotationRoot } from "./parsers/type.js";
import { Tokenizer } from "./tokenizer.js";

export function parseTypeExpression(lines: Lines): JsdocTypeExpression | null {
  const tokenizer = new Tokenizer(lines);
  const state = new ParserState(tokenizer);
  const typeAnnotation = parseTypeAnnotationRoot(state);
  if (!typeAnnotation) return null;
  const node: JsdocTypeExpression = {
    type: "JsdocTypeExpression",
    typeAnnotation,
    tokens: [],
    loc: {
      start: typeAnnotation.loc.start,
      end: typeAnnotation.loc.end,
    },
  };

  node.tokens.push(...state.tokens);
  return node;
}

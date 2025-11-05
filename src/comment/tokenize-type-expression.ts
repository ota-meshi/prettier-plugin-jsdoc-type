import type { JsdocTypeExpression } from "./ast.js";
import { parseTypeExpression } from "./parse-type-expression.js";
import * as commentParser from "comment-parser";

const typeTokenizer = commentParser.tokenizers.type("preserve");

export type JsdocTypeExpressionSpec = commentParser.Spec & {
  typeExpression?: JsdocTypeExpression;
};

class SpecLines {
  private readonly lines: string[] = [];

  public constructor(spec: commentParser.Spec) {
    let first = true;
    let lastIndex = -1;
    for (const [index, lineType] of spec.source
      .map((l) => l.tokens.type)
      .entries()) {
      if (lineType) {
        this.lines.push(
          first && lineType.startsWith("{")
            ? ` ${lineType.slice(1)}`
            : lineType,
        );
        first = false;
        lastIndex = index;
      }
    }
    if (lastIndex >= 0) {
      this.lines[lastIndex] = this.lines[lastIndex].replace(/\}$/u, " ");
    }
  }

  public getLine(lineNumber: number): string | null {
    const lineIndex = lineNumber - 1;
    return this.lines[lineIndex] ?? null;
  }
}

export function tokenizeTypeExpression(
  spec: commentParser.Spec,
): commentParser.Spec {
  const typeSpec = typeTokenizer(spec);

  const node = parseTypeExpression(new SpecLines(typeSpec));
  if (node) {
    (typeSpec as JsdocTypeExpressionSpec).typeExpression = node;
  }

  return typeSpec;
}

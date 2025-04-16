import type { JsdocImportTagType, Position, Token } from "./ast.js";
import { parseImportType } from "./parse-import-type.js";
import type * as commentParser from "comment-parser";

export type JsdocImportTagSpec = commentParser.Spec & {
  importTagType?: JsdocImportTagType;
};

class SpecLines {
  private readonly spec: commentParser.Spec;

  private readonly postDelimiterOffset: number;

  private cache: (string | undefined)[] = [];

  public constructor(spec: commentParser.Spec) {
    this.spec = spec;
    this.postDelimiterOffset = spec.source[0].tokens.postDelimiter.length;
  }

  public getLine(lineNumber: number): string | null {
    const lineIndex = lineNumber - 1;
    if (this.cache[lineIndex]) {
      return this.cache[lineIndex];
    }
    const tokens = this.spec.source[lineIndex]?.tokens;
    if (!tokens) return null;
    return (this.cache[lineIndex] =
      lineIndex === 0 || this.postDelimiterOffset === 0
        ? tokens.description
        : tokens.postDelimiter.slice(this.postDelimiterOffset) +
          tokens.description);
  }
}

export function tokenizeImportType(
  spec: commentParser.Spec,
): commentParser.Spec {
  const lines = new SpecLines(spec);
  const node = parseImportType(lines);
  if (!node) return spec;

  const lastToken: Token = node.tokens[node.tokens.length - 1];

  postprocess(spec, lines, lastToken.loc.end);
  (spec as JsdocImportTagSpec).importTagType = node;
  return spec;
}

function postprocess(
  spec: commentParser.Spec,
  lines: SpecLines,
  endPos: Position,
) {
  // Update the source type of the comment-parser Spec.
  const parts: string[] = [];

  for (let i = 0; i < endPos.line; i++) {
    const tokens = spec.source[i].tokens;
    const line = i + 1;
    const text = lines.getLine(line)!;
    if (tokens.description.length < text.length) {
      // The description has been updated to remove the postDelimiter part.
      const diff = text.length - tokens.description.length;
      tokens.description = text;
      tokens.postDelimiter = tokens.postDelimiter.slice(0, -diff);
    }
    if (line < endPos.line) {
      tokens.type = tokens.description;
      tokens.description = "";
    } else {
      tokens.type = tokens.description.slice(0, endPos.column);
      tokens.description = tokens.description.slice(tokens.type.length);

      const spaces = /^\s+/u.exec(tokens.description)?.[0];
      if (spaces) {
        tokens.postType = spaces;
        tokens.description = tokens.description.slice(spaces.length);
      }
    }
    parts.push(tokens.type);
  }

  spec.type = parts.join("\n");
}

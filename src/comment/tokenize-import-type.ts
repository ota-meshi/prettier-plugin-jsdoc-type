import type * as commentParser from "comment-parser";

const RE_ID = /[\p{ID_Start}$_][\p{ID_Continue}$\u200c\u200d]*/uy;
const RE_STRING = /(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/uy;
const RE_WHITESPACE = /\s+/uy;

type Pos = {
  sourceIndex: number;
  charIndex: number;
};

class ParserState {
  private readonly spec: commentParser.Spec;

  private current: Pos;

  private next: Pos;

  public constructor(spec: commentParser.Spec) {
    this.spec = spec;

    this.current = {
      sourceIndex: 0,
      charIndex: 0,
    };
    this.next = {
      sourceIndex: 0,
      charIndex: 0,
    };
    this.setCurrentPosition(this.current);
  }

  public getCurrentPosition() {
    return { ...this.current };
  }

  public setCurrentPosition(pos: Pos): void {
    this.next = this.current = { ...pos };

    // Skip whitespaces for next position
    let line;
    while ((line = this.spec.source[this.next.sourceIndex])) {
      const text = line.tokens.description;
      RE_WHITESPACE.lastIndex = this.next.charIndex;
      const matchText = RE_WHITESPACE.exec(text)?.[0];
      if (!matchText) return;
      this.next = this.getAdvancePos(this.next, matchText.length);
    }
  }

  public eatKeyword(test: string): string | null {
    const re = new RegExp(`\\b${test}\\b`, "uy");
    return this.eat(re);
  }

  public eat(test: "*" | ";" | "," | "{" | "}" | ":" | RegExp): string | null {
    const pos = this.next;
    const line = this.spec.source[pos.sourceIndex];
    if (!line) return null;
    const text = line.tokens.description;
    if (typeof test === "string") {
      if (!text.startsWith(test, pos.charIndex)) return null;
      this.setCurrentPosition(this.getAdvancePos(pos, test.length));
      return test;
    }
    const re = test.sticky ? test : new RegExp(test, "uy");
    re.lastIndex = pos.charIndex;
    const matchText = re.exec(text)?.[0];
    if (!matchText) return null;
    this.setCurrentPosition(this.getAdvancePos(pos, matchText.length));
    return matchText;
  }

  private getAdvancePos(pos: Pos, count: number): Pos {
    let line = this.spec.source[pos.sourceIndex];
    if (!line) return pos;
    let sourceIndex = pos.sourceIndex;
    let charIndex = pos.charIndex + count;
    while (charIndex >= line.tokens.description.length) {
      sourceIndex++;
      charIndex = charIndex - line.tokens.description.length;
      line = this.spec.source[sourceIndex];
      if (!line) {
        charIndex = 0;
        break;
      }
    }

    return { sourceIndex, charIndex };
  }
}

export function tokenizeImportType(
  spec: commentParser.Spec,
): commentParser.Spec {
  const state = new ParserState(spec);
  if (!parseImportClause(state)) return spec;
  if (!state.eatKeyword("from")) return spec;
  if (!state.eat(RE_STRING)) return spec;

  const posForEndOfSource = state.getCurrentPosition();
  if (state.eatKeyword("with")) {
    if (!parseImportAttributes(state)) {
      state.setCurrentPosition(posForEndOfSource);
    }
  }
  state.eat(";");

  const parts: string[] = [];
  let offset = 0;
  for (const { tokens, type, first } of iterateTypeTokens(
    state.getCurrentPosition(),
    spec,
  )) {
    tokens.type = type;
    if (first) {
      offset = tokens.postDelimiter.length;
    } else {
      tokens.type = tokens.postDelimiter.slice(offset) + type;
      tokens.postDelimiter = tokens.postDelimiter.slice(0, offset);
    }
    [tokens.postType, tokens.description] = splitSpace(
      tokens.description.slice(type.length),
    );
    parts.push(tokens.type);
  }

  spec.type = parts.join("\n");
  return spec;
}

function parseImportClause(state: ParserState): boolean {
  if (parseNamespaceImport(state)) {
    return true;
  }
  if (state.eat(RE_ID)) {
    // Default import
    if (state.eat(",")) {
      return parseNamedImports(state);
    }
    return true;
  }

  return parseNamedImports(state);
}

function parseNamespaceImport(state: ParserState): boolean {
  return Boolean(state.eat("*") && state.eatKeyword("as") && state.eat(RE_ID));
}

function parseNamedImports(state: ParserState): boolean {
  if (!state.eat("{")) return false;
  do {
    if (state.eat("}")) return true;
    if (!parseImportSpec(state)) return false;
  } while (state.eat(","));
  return Boolean(state.eat("}"));
}

function parseImportSpec(state: ParserState): boolean {
  let hasType = false;
  if (state.eatKeyword("type")) {
    hasType = true;
    if (state.eatKeyword("as")) {
      state.eatKeyword("as");
      state.eatKeyword("as");
      // import { type as } from "mod"
      // import { type as as } from "mod"
      // import { type as as as } from "mod"
      return true;
    }
  }

  if (!state.eat(RE_ID) && !state.eat(RE_STRING)) {
    // Maybe `import { type } from "mod"`
    return hasType;
  }
  if (state.eatKeyword("as")) {
    if (!state.eat(RE_ID)) return false;
  }
  return true;
}

function parseImportAttributes(state: ParserState): boolean {
  if (!state.eat("{")) return false;
  do {
    if (state.eat("}")) return true;
    if (!parseImportAttribute(state)) return false;
  } while (state.eat(","));
  return Boolean(state.eat("}"));
}

function parseImportAttribute(state: ParserState): boolean {
  if (!state.eat(RE_ID) && !state.eat(RE_STRING)) return false;
  if (!state.eat(":")) return false;
  if (!state.eat(RE_STRING)) return false;
  return true;
}

function* iterateTypeTokens(
  endPos: Pos,
  spec: commentParser.Spec,
): Iterable<{
  tokens: commentParser.Tokens;
  type: string;
  first: boolean;
}> {
  const source = spec.source;
  const lastLine = source[endPos.sourceIndex];
  for (let sourceIndex = 0; sourceIndex < endPos.sourceIndex; sourceIndex++) {
    const line = source[sourceIndex];
    if (!line) continue;
    yield {
      tokens: line.tokens,
      type: line.tokens.description,
      first: sourceIndex === 0,
    };
  }
  const line = source[endPos.sourceIndex];
  if (!line) return;
  const type = lastLine.tokens.description.slice(0, endPos.charIndex);
  yield {
    tokens: lastLine.tokens,
    type,
    first: endPos.sourceIndex === 0,
  };
}

function splitSpace(source: string): [string, string] {
  const matches = /^\s+/u.exec(source);
  return matches == null
    ? ["", source]
    : [source.slice(0, matches[0].length), source.slice(matches[0].length)];
}

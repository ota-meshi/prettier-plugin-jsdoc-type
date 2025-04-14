import type * as commentParser from "comment-parser";

type Pos = {
  readonly sourceIndex: number;
  readonly charIndex: number;
};
type Keyword = "type" | "as" | "from" | "with";
type Punctuation = "*" | ";" | "," | "{" | "}" | ":";
type IdToken = { type: "id"; value: string; pos: Pos };
type StrToken = { type: "str"; value: string; pos: Pos };
type SpaceToken = { type: "space"; value: string; pos: Pos };
type PunctuationToken = {
  type: Punctuation;
  value: string;
  pos: Pos;
};
type UnknownToken = { type: "unknown"; value: string; pos: Pos };
type Token = IdToken | StrToken | SpaceToken | PunctuationToken | UnknownToken;
type TokenBuilder = (text: string, pos: Pos) => Token | null;
const TOKEN_BUILDERS: TokenBuilder[] = [
  regexpToTokenBuilder(
    /[\p{ID_Start}$_][\p{ID_Continue}$\u200c\u200d]*/uy,
    "id",
  ),
  regexpToTokenBuilder(
    /(?<quote>["'])(?:[^\n\r"'\\]+|(?!\k<quote>)["']|\\(?:\r\n|[\s\S]))\k<quote>/uy,
    "str",
  ),
  regexpToTokenBuilder(/\s+/uy, "space"),
  (text, pos) => {
    const c = text[pos.charIndex];
    return ["*", ";", ",", "{", "}", ":"].includes(c)
      ? { type: c as Punctuation, value: c, pos }
      : null;
  },
  regexpToTokenBuilder(/[\s\S]/uy, "unknown"),
];

function regexpToTokenBuilder(re: RegExp, type: Token["type"]): TokenBuilder {
  return (text, pos) => {
    re.lastIndex = pos.charIndex;
    const value = re.exec(text)?.[0];
    if (!value) return null;
    return { type, value, pos };
  };
}

class Tokenizer {
  private readonly spec: commentParser.Spec;

  private pos: Pos = { sourceIndex: 0, charIndex: 0 };

  public constructor(spec: commentParser.Spec) {
    this.spec = spec;
  }

  public next(): Token | null {
    const { sourceIndex, charIndex } = this.pos;
    const line = this.spec.source[sourceIndex];
    if (!line) return null;
    const text = line.tokens.description;
    if (text.length <= charIndex) {
      this.pos = { sourceIndex: sourceIndex + 1, charIndex: 0 };
      return this.next();
    }
    for (const builder of TOKEN_BUILDERS) {
      const token = builder(text, this.pos);
      if (!token) continue;
      this.pos = {
        sourceIndex,
        charIndex: charIndex + token.value.length,
      };
      return token;
    }
    throw new Error("Unexpected token");
  }
}

class ParserState {
  public readonly tokenizer: Tokenizer;

  public current: Token | null = null;

  public constructor(spec: commentParser.Spec) {
    this.tokenizer = new Tokenizer(spec);
    this.advance();
  }

  public eat(type: Token["type"]): Token | null {
    if (this.current?.type !== type) return null;
    const result = this.current;
    this.advance();
    return result;
  }

  public eatValue(value: Keyword): Token | null {
    if (this.current?.value !== value) return null;
    const result = this.current;
    this.advance();
    return result;
  }

  public advance(): Token | null {
    this.current = this.tokenizer.next();
    if (this.current?.type !== "space") {
      return this.current;
    }
    return this.advance();
  }
}

export function tokenizeImportType(
  spec: commentParser.Spec,
): commentParser.Spec {
  const state = new ParserState(spec);
  if (!parseImportClause(state)) return spec;
  if (!state.eatValue("from")) return spec;
  let lastToken = state.eat("str");
  if (!lastToken) return spec;

  const semi = state.eat(";");
  if (semi) {
    lastToken = semi;
  } else if (state.eatValue("with")) {
    const attrsToken = parseImportAttributes(state);
    if (attrsToken) {
      lastToken = state.eat(";") || attrsToken;
    }
  }

  const parts: string[] = [];
  let offset = 0;
  for (const { tokens, type, first } of iterateTypeTokens(
    {
      sourceIndex: lastToken.pos.sourceIndex,
      charIndex: lastToken.pos.charIndex + lastToken.value.length,
    },
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

function parseImportClause(state: ParserState): Token | null {
  let token;
  if ((token = parseNamespaceImport(state))) {
    return token;
  }
  if ((token = state.eat("id"))) {
    // Default import
    if (state.eat(",")) {
      return parseNamedImports(state);
    }
    return token;
  }

  return parseNamedImports(state);
}

function parseNamespaceImport(state: ParserState): Token | null {
  return state.eat("*") && state.eatValue("as") && state.eat("id");
}

function parseNamedImports(state: ParserState): Token | null {
  return parseElementsWithBraces(state, parseImportSpec);
}

function parseImportSpec(state: ParserState): Token | null {
  let typeToken: Token | null = null;
  if ((typeToken = state.eatValue("type"))) {
    let asToken1;
    if ((asToken1 = state.eatValue("as"))) {
      const asToken2 = state.eatValue("as");
      // import { type as as } from "mod"
      // import { type as as as } from "mod"
      // import { type as as X } from "mod"

      // import { type as } from "mod"
      // import { type as X } from "mod"
      return state.eat("id") || asToken2 || asToken1;
    }
  }

  const keyToken = state.eat("id") || state.eat("str");
  if (!keyToken) {
    // Maybe `import { type } from "mod"`
    return typeToken;
  }
  if (state.eatValue("as")) {
    return state.eat("id");
  }
  return keyToken;
}

function parseImportAttributes(state: ParserState): Token | null {
  return parseElementsWithBraces(state, parseImportAttribute);
}

function parseImportAttribute(state: ParserState): Token | null {
  const keyToken = state.eat("id") || state.eat("str");
  if (!keyToken) return null;
  if (!state.eat(":")) return null;
  return state.eat("str");
}

function parseElementsWithBraces(
  state: ParserState,
  parseElement: (state: ParserState) => Token | null,
): Token | null {
  if (!state.eat("{")) return null;
  do {
    const close = state.eat("}");
    if (close) return close;
    if (!parseElement(state)) return null;
  } while (state.eat(","));
  return state.eat("}");
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
  const spaces = /^\s+/u.exec(source)?.[0];
  return spaces ? [spaces, source.slice(spaces.length)] : ["", source];
}

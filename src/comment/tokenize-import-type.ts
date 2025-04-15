import type * as commentParser from "comment-parser";

export type JsdocImportTagSpec = commentParser.Spec & {
  importTagType?: JsdocImportTagType;
};
export type JsdocImportTagType = {
  type: "JsdocImportTagType";
  specifiers: (
    | JsdocImportTagTypeImportSpecifier
    | JsdocImportTagTypeImportDefaultSpecifier
    | JsdocImportTagTypeImportNamespaceSpecifier
  )[];
  source: StringToken;
  attributes: JsdocImportTagTypeImportAttribute[];
  tokens: Token[];
};
export type JsdocImportTagTypeImportSpecifier = {
  type: "JsdocImportTagTypeImportSpecifier";
  imported: IdentifierToken | StringToken;
  importKind: "type" | "value";
  local: IdentifierToken;
};
export type JsdocImportTagTypeImportDefaultSpecifier = {
  type: "JsdocImportTagTypeImportDefaultSpecifier";
  local: IdentifierToken;
};
export type JsdocImportTagTypeImportNamespaceSpecifier = {
  type: "JsdocImportTagTypeImportNamespaceSpecifier";
  local: IdentifierToken;
};
export type JsdocImportTagTypeImportAttribute = {
  type: "JsdocImportTagTypeImportAttribute";
  key: IdentifierToken | StringToken;
  value: StringToken;
};

type DescriptionPos = {
  sourceIndex: number;
  charIndex: number;
};
type Pos = {
  number: number;
  /** The offset position within the `type` text. */
  typeOffset: number;
};
type Keyword = "type" | "as" | "from" | "with";
type Punctuator = "*" | ";" | "," | "{" | "}" | ":";
type BaseToken<T extends string> = {
  type: T;
  value: string;
  pos: Pos;
  /** @private */
  _descPos?: DescriptionPos;
};
type IdentifierToken = BaseToken<"Identifier">;
type StringToken = BaseToken<"String">;
type SpaceToken = BaseToken<"Whitespace">;
type PunctuatorToken = BaseToken<"Punctuator">;
type Token = IdentifierToken | StringToken | SpaceToken | PunctuatorToken;
type TokenBuilder = (
  line: commentParser.Line,
  pos: DescriptionPos,
) => Token | null;
const TOKEN_BUILDERS: TokenBuilder[] = [
  regexpToTokenBuilder(
    /[\p{ID_Start}$_][\p{ID_Continue}$\u200c\u200d]*/uy,
    "Identifier",
  ),
  regexpToTokenBuilder(
    /(?<quote>["'])(?:[^\n\r"'\\]+|(?!\k<quote>)["']|\\(?:\r\n|[\s\S]))\k<quote>/uy,
    "String",
  ),
  regexpToTokenBuilder(/\s+/uy, "Whitespace"),
  (line, descPos) => {
    const c = line.tokens.description[descPos.charIndex];
    return ["*", ";", ",", "{", "}", ":"].includes(c)
      ? {
          type: "Punctuator",
          value: c,
          pos: { number: line.number, typeOffset: descPos.charIndex },
          _descPos: descPos,
        }
      : null;
  },
];

function regexpToTokenBuilder(re: RegExp, type: Token["type"]): TokenBuilder {
  return (line, descPos) => {
    re.lastIndex = descPos.charIndex;
    const value = re.exec(line.tokens.description)?.[0];
    if (!value) return null;
    return {
      type,
      value,
      pos: { number: line.number, typeOffset: descPos.charIndex },
      _descPos: descPos,
    };
  };
}

class Tokenizer {
  private readonly spec: commentParser.Spec;

  private descPos: DescriptionPos = { sourceIndex: 0, charIndex: 0 };

  public readonly tokens: Token[] = [];

  public constructor(spec: commentParser.Spec) {
    this.spec = spec;
  }

  public next(): Token | null {
    const { sourceIndex, charIndex } = this.descPos;
    const line = this.spec.source[sourceIndex];
    if (!line) return null;
    const text = line.tokens.description;
    if (text.length <= charIndex) {
      this.descPos = { sourceIndex: sourceIndex + 1, charIndex: 0 };
      return this.next();
    }
    for (const builder of TOKEN_BUILDERS) {
      const token = builder(line, this.descPos);
      if (!token) continue;
      this.descPos = {
        sourceIndex,
        charIndex: charIndex + token.value.length,
      };
      this.tokens.push(token);
      return token;
    }
    return null;
  }
}

class ParserState {
  public readonly tokenizer: Tokenizer;

  public current: Token | null = null;

  public constructor(spec: commentParser.Spec) {
    this.tokenizer = new Tokenizer(spec);
    this.advance();
  }

  public get tokens(): Token[] {
    return this.tokenizer.tokens;
  }

  public eat<T extends Token["type"]>(
    type: T,
  ): Extract<Token, { type: T }> | null {
    if (this.current?.type !== type) return null;
    const result = this.current;
    this.advance();
    return result as Extract<Token, { type: T }>;
  }

  public eatValue(value: Keyword): IdentifierToken | null;

  public eatValue(value: Punctuator): PunctuatorToken | null;

  public eatValue(
    value: Keyword | Punctuator,
  ): PunctuatorToken | IdentifierToken | null {
    if (this.current?.value !== value) return null;
    const result = this.current;
    this.advance();
    return result as PunctuatorToken | IdentifierToken;
  }

  public advance(): Token | null {
    this.current = this.tokenizer.next();
    if (this.current?.type !== "Whitespace") {
      return this.current;
    }
    return this.advance();
  }
}

export function tokenizeImportType(
  spec: commentParser.Spec,
): commentParser.Spec {
  const state = new ParserState(spec);
  let specifiers;
  if (!(specifiers = parseImportClause(state))) return spec;
  if (!state.eatValue("from")) return spec;
  const source = state.eat("String");
  if (!source) return spec;

  const node: JsdocImportTagType = {
    type: "JsdocImportTagType",
    specifiers,
    source,
    attributes: [],
    tokens: [],
  };

  let lastToken: Token = source;

  const semi = state.eatValue(";");
  if (semi) {
    lastToken = semi;
  } else if (state.eatValue("with")) {
    const attributes = parseImportAttributes(state);
    if (attributes) {
      node.attributes = attributes.elements;
      lastToken = state.eatValue(";") || attributes.close;
    }
  }

  postprocess(spec, state.tokens, node, {
    sourceIndex: lastToken._descPos!.sourceIndex,
    charIndex: lastToken._descPos!.charIndex + lastToken.value.length,
  });
  return spec;
}

function postprocess(
  spec: commentParser.Spec,
  astTokens: Token[],
  node: JsdocImportTagType,
  endDescPos: DescriptionPos,
) {
  // From the generated AST tokens, extract only tokens that are within the Node range.
  // Also, remove _descPos.
  for (const t of astTokens) {
    const descPos = t._descPos!;
    delete t._descPos;
    if (
      descPos.sourceIndex < endDescPos.sourceIndex ||
      (descPos.sourceIndex === endDescPos.sourceIndex &&
        descPos.charIndex < endDescPos.charIndex)
    ) {
      node.tokens.push(t);
    }
  }

  // Update the source type of the comment-parser Spec.
  const parts: string[] = [];
  let offset = 0;
  for (const { line, type, first } of iterateTypeLines(endDescPos, spec)) {
    const tokens = line.tokens;
    tokens.type = type;
    if (first) {
      offset = tokens.postDelimiter.length;
    } else {
      const preType = tokens.postDelimiter.slice(offset);
      if (preType) {
        tokens.type = preType + type;
        tokens.postDelimiter = tokens.postDelimiter.slice(0, offset);

        // Adjust the position of the AST tokens
        for (const t of node.tokens) {
          if (t.pos.number === line.number) t.pos.typeOffset += preType.length;
        }
      }
    }
    tokens.description = tokens.description.slice(type.length);
    const spaces = /^\s+/u.exec(tokens.description)?.[0];
    if (spaces) {
      tokens.postType = spaces;
      tokens.description = tokens.description.slice(spaces.length);
    }
    parts.push(tokens.type);
  }

  spec.type = parts.join("\n");
  (spec as JsdocImportTagSpec).importTagType = node;
}

function parseImportClause(
  state: ParserState,
):
  | (
      | JsdocImportTagTypeImportSpecifier
      | JsdocImportTagTypeImportDefaultSpecifier
      | JsdocImportTagTypeImportNamespaceSpecifier
    )[]
  | null {
  if (state.eatValue("*")) {
    // import * as X from "mod"
    const local = state.eatValue("as") && state.eat("Identifier");
    return (
      local && [
        {
          type: "JsdocImportTagTypeImportNamespaceSpecifier",
          local,
        },
      ]
    );
  }
  const local = state.eat("Identifier");
  if (local) {
    const defaultSpec: JsdocImportTagTypeImportDefaultSpecifier = {
      type: "JsdocImportTagTypeImportDefaultSpecifier",
      local,
    };
    if (!state.eatValue(",")) {
      // import X from "mod"
      return [defaultSpec];
    }
    // import X, {...} from "mod"
    const specifiers = parseNamedImports(state);
    return specifiers && [defaultSpec, ...specifiers];
  }

  // import {...} from "mod"
  return parseNamedImports(state);
}

function parseNamedImports(
  state: ParserState,
): JsdocImportTagTypeImportSpecifier[] | null {
  const parsed = parseElementsWithBraces(state, parseImportSpec);
  return parsed && parsed.elements;
}

function parseImportSpec(
  state: ParserState,
): JsdocImportTagTypeImportSpecifier | null {
  let type: Token | null = null;
  if ((type = state.eatValue("type"))) {
    let as1;
    if ((as1 = state.eatValue("as"))) {
      const as2 = state.eatValue("as");
      const local = state.eat("Identifier");
      if (local && as2) {
        // import { type as as as } from "mod"
        // import { type as as X } from "mod"
        return {
          type: "JsdocImportTagTypeImportSpecifier",
          importKind: "type",
          imported: as1,
          local,
        };
      }
      const valueLocal = as2 || local;
      if (valueLocal) {
        // import { type as X } from "mod"
        // import { type as as } from "mod"
        return {
          type: "JsdocImportTagTypeImportSpecifier",
          importKind: "value",
          imported: type,
          local: valueLocal,
        };
      }
      // import { type as } from "mod"
      return {
        type: "JsdocImportTagTypeImportSpecifier",
        importKind: "type",
        imported: as1,
        local: as1,
      };
    }
  }

  const imported = state.eat("Identifier") || state.eat("String");
  if (!imported) {
    return (
      type && {
        // `import { type } from "mod"`
        type: "JsdocImportTagTypeImportSpecifier",
        importKind: "value",
        imported: type,
        local: type,
      }
    );
  }
  if (state.eatValue("as")) {
    const local = state.eat("Identifier");
    return (
      local && {
        // `import { x as X } from "mod"`
        // `import { 'str' as X } from "mod"`
        type: "JsdocImportTagTypeImportSpecifier",
        importKind: type ? "type" : "value",
        imported,
        local,
      }
    );
  }
  return imported.type === "Identifier"
    ? {
        // `import { X } from "mod"`
        type: "JsdocImportTagTypeImportSpecifier",
        importKind: type ? "type" : "value",
        imported,
        local: imported,
      }
    : null;
}

function parseImportAttributes(state: ParserState): {
  elements: JsdocImportTagTypeImportAttribute[];
  close: PunctuatorToken;
} | null {
  return parseElementsWithBraces(state, parseImportAttribute);
}

function parseImportAttribute(
  state: ParserState,
): JsdocImportTagTypeImportAttribute | null {
  const key = state.eat("Identifier") || state.eat("String");
  if (!key) return null;
  if (!state.eatValue(":")) return null;
  const value = state.eat("String");
  return (
    value && {
      type: "JsdocImportTagTypeImportAttribute",
      key,
      value,
    }
  );
}

function parseElementsWithBraces<E>(
  state: ParserState,
  parseElement: (state: ParserState) => E | null,
): { elements: E[]; close: PunctuatorToken } | null {
  const elements: E[] = [];
  if (!state.eatValue("{")) return null;
  do {
    const close = state.eatValue("}");
    if (close) return { elements, close };
    const element = parseElement(state);
    if (!element) return null;
    elements.push(element);
  } while (state.eatValue(","));
  const close = state.eatValue("}");
  return close && { elements, close };
}

function* iterateTypeLines(
  endDescPos: DescriptionPos,
  spec: commentParser.Spec,
): Iterable<{
  line: commentParser.Line;
  type: string;
  first: boolean;
}> {
  const source = spec.source;
  const lastLine = source[endDescPos.sourceIndex];
  for (
    let sourceIndex = 0;
    sourceIndex < endDescPos.sourceIndex;
    sourceIndex++
  ) {
    const line = source[sourceIndex];
    if (!line) continue;
    yield {
      line,
      type: line.tokens.description,
      first: sourceIndex === 0,
    };
  }
  const line = source[endDescPos.sourceIndex];
  if (!line) return;
  const type = lastLine.tokens.description.slice(0, endDescPos.charIndex);
  yield {
    line: lastLine,
    type,
    first: endDescPos.sourceIndex === 0,
  };
}

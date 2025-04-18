import type {
  IdentifierToken,
  JsdocImportTagType,
  JsdocImportTagTypeImportAttribute,
  JsdocImportTagTypeImportDefaultSpecifier,
  JsdocImportTagTypeImportNamespaceSpecifier,
  JsdocImportTagTypeImportSpecifier,
  Keyword,
  Punctuator,
  PunctuatorToken,
  Token,
} from "./ast.js";
import { identifier, identifierOrLiteral, literal } from "./ast.js";
import type { Lines } from "./lines.js";
import { Tokenizer } from "./tokenizer.js";

class ParserState {
  public readonly tokenizer: Tokenizer;

  public current: Token | null = null;

  public constructor(tokenizer: Tokenizer) {
    this.tokenizer = tokenizer;
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

  private advance(): void {
    this.current = this.tokenizer.next();
  }
}

export function parseImportType(lines: Lines): JsdocImportTagType | null {
  const tokenizer = new Tokenizer(lines);
  const state = new ParserState(tokenizer);
  let specifiers;
  if (!(specifiers = parseImportClause(state))) return null;
  if (!state.eatValue("from")) return null;
  const source = state.eat("String");
  if (!source) return null;

  const node: JsdocImportTagType = {
    type: "JsdocImportTagType",
    specifiers,
    source: literal(source),
    attributes: [],
    tokens: [],
    loc: {
      start: tokenizer.tokens[0].loc.start,
      end: source.loc.end,
    },
  };

  const semi = state.eatValue(";");
  if (semi) {
    node.loc.end = semi.loc.end;
  } else if (state.eatValue("with")) {
    const attributes = parseImportAttributes(state);
    if (attributes) {
      node.attributes = attributes.elements;
      node.loc.end = (state.eatValue(";") || attributes.close).loc.end;
    }
  }

  // From the generated AST tokens, extract only tokens that are within the Node range.
  for (const t of state.tokens) {
    if (
      t.loc.end.line < node.loc.end.line ||
      (t.loc.end.line === node.loc.end.line &&
        t.loc.end.column <= node.loc.end.column)
    ) {
      node.tokens.push(t);
    }
  }
  return node;
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
  const asterisk = state.eatValue("*");
  if (asterisk) {
    // import * as X from "mod"
    const local = state.eatValue("as") && state.eat("Identifier");
    return (
      local && [
        {
          type: "ImportNamespaceSpecifier",
          local: identifier(local),
          loc: {
            start: asterisk.loc.start,
            end: local.loc.end,
          },
        },
      ]
    );
  }
  const local = state.eat("Identifier");
  if (local) {
    const defaultSpec: JsdocImportTagTypeImportDefaultSpecifier = {
      type: "ImportDefaultSpecifier",
      local: identifier(local),
      loc: { ...local.loc },
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
          type: "ImportSpecifier",
          importKind: "type",
          imported: identifier(as1),
          local: identifier(local),
          loc: {
            start: type.loc.start,
            end: local.loc.end,
          },
        };
      }
      const valueLocal = as2 || local;
      if (valueLocal) {
        // import { type as X } from "mod"
        // import { type as as } from "mod"
        return {
          type: "ImportSpecifier",
          importKind: "value",
          imported: identifier(type),
          local: identifier(valueLocal),
          loc: {
            start: type.loc.start,
            end: valueLocal.loc.end,
          },
        };
      }
      // import { type as } from "mod"
      return {
        type: "ImportSpecifier",
        importKind: "type",
        imported: identifier(as1),
        local: identifier(as1),
        loc: {
          start: type.loc.start,
          end: as1.loc.end,
        },
      };
    }
  }

  const imported = state.eat("Identifier") || state.eat("String");
  if (!imported) {
    return (
      type && {
        // `import { type } from "mod"`
        type: "ImportSpecifier",
        importKind: "value",
        imported: identifier(type),
        local: identifier(type),
        loc: { ...type.loc },
      }
    );
  }
  if (state.eatValue("as")) {
    const local = state.eat("Identifier");
    return (
      local && {
        // `import { x as X } from "mod"`
        // `import { 'str' as X } from "mod"`
        type: "ImportSpecifier",
        importKind: type ? "type" : "value",
        imported: identifierOrLiteral(imported),
        local: identifier(local),
        loc: {
          start: (type ?? imported).loc.start,
          end: local.loc.end,
        },
      }
    );
  }
  return imported.type === "Identifier"
    ? {
        // `import { X } from "mod"`
        type: "ImportSpecifier",
        importKind: type ? "type" : "value",
        imported: identifier(imported),
        local: identifier(imported),
        loc: {
          start: (type ?? imported).loc.start,
          end: imported.loc.end,
        },
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
      type: "ImportAttribute",
      key: identifierOrLiteral(key),
      value: literal(value),
      loc: {
        start: key.loc.start,
        end: value.loc.end,
      },
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

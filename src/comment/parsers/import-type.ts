import type {
  JsdocImportTagTypeImportAttribute,
  JsdocImportTagTypeImportDefaultSpecifier,
  JsdocImportTagTypeImportNamespaceSpecifier,
  JsdocImportTagTypeImportSpecifier,
  JsdocStringLiteral,
  PunctuatorToken,
  Token,
} from "../ast.js";
import { identifier, identifierOrLiteral, literal } from "../node.js";
import type { ParserState } from "../parser-state.js";
import { parseDelimitedList } from "./list.js";

export function parseImportType(state: ParserState): {
  specifiers: (
    | JsdocImportTagTypeImportSpecifier
    | JsdocImportTagTypeImportDefaultSpecifier
    | JsdocImportTagTypeImportNamespaceSpecifier
  )[];
  source: JsdocStringLiteral;
  attributes?: {
    elements: JsdocImportTagTypeImportAttribute[];
    close: PunctuatorToken;
  };
} | null {
  const parsed = state.tryParse(() => {
    const specifiers = parseImportClause(state);
    if (!specifiers) return null;
    if (!state.eatValue("from")) return null;
    const source = state.eat("String");
    if (!source) return null;
    return {
      specifiers,
      source: literal(source),
    };
  });
  if (!parsed) return null;

  if (state.lookAheadValue(";")) {
    return parsed;
  }
  const attributes = state.tryParse(() => {
    const r = state.eatValue("with") && parseImportAttributes(state);
    return r;
  });
  if (!attributes) return parsed;

  return {
    ...parsed,
    attributes,
  };
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
  if (!state.eatValue("{")) return null;
  return parseDelimitedList(state, "}", parseElement);
}

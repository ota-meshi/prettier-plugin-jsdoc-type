import type {
  JsdocArrayPattern,
  JsdocAssignmentPattern,
  JsdocIdentifier,
  JsdocNumberLiteral,
  JsdocObjectPattern,
  JsdocProperty,
  JsdocRestElement,
  JsdocStringLiteral,
  Location,
} from "../ast.js";
import { identifier, literal } from "../node.js";
import type { ParserState } from "../parser-state.js";
import { parseDelimitedList } from "./list.js";

export function parseIdentifierOrPattern(
  state: ParserState,
): JsdocIdentifier | JsdocArrayPattern | JsdocObjectPattern | null {
  // See https://github.com/microsoft/TypeScript/blob/0a1aa6d6ebdfa16b82f4a6aaf282089b1d484e05/src/compiler/parser.ts#L7610
  if (state.lookAheadValue("[")) {
    return parseArrayBindingPattern(state);
  }
  if (state.lookAheadValue("{")) {
    return parseObjectBindingPattern(state);
  }
  const idToken = state.eat("Identifier");
  return idToken && identifier(idToken);
}

export function isBindingIdentifierOrPattern(state: ParserState): boolean {
  // See https://github.com/microsoft/TypeScript/blob/0a1aa6d6ebdfa16b82f4a6aaf282089b1d484e05/src/compiler/parser.ts#L7603
  if (state.lookAheadValue("{") || state.lookAheadValue("[")) return true;
  return state.lookAhead(() => Boolean(state.eat("Identifier")));
}

function parseArrayBindingPattern(
  state: ParserState,
): JsdocArrayPattern | null {
  return state.tryParse(() => {
    // See https://github.com/microsoft/TypeScript/blob/0a1aa6d6ebdfa16b82f4a6aaf282089b1d484e05/src/compiler/parser.ts#L7595
    const open = state.eatValue("[");
    if (!open) return null;
    const elements = parseDelimitedList(state, "]", parseArrayBindingElement);
    if (!elements) return null;
    return {
      type: "ArrayPattern",
      elements: elements.elements.map((e) => e.node),
      optional: false,
      loc: {
        start: open.loc.start,
        end: elements.close.loc.end,
      },
    };
  });
}

function parseObjectBindingPattern(
  state: ParserState,
): JsdocObjectPattern | null {
  return state.tryParse(() => {
    // See https://github.com/microsoft/TypeScript/blob/0a1aa6d6ebdfa16b82f4a6aaf282089b1d484e05/src/compiler/parser.ts#L7587
    const open = state.eatValue("{");
    if (!open) return null;
    const elements = parseDelimitedList(state, "}", parseObjectBindingElement);
    if (!elements) return null;
    return {
      type: "ObjectPattern",
      properties: elements.elements,
      optional: false,
      loc: {
        start: open.loc.start,
        end: elements.close.loc.end,
      },
    };
  });
}

function parseArrayBindingElement(state: ParserState): {
  node:
    | JsdocArrayPattern
    | JsdocAssignmentPattern
    | JsdocIdentifier
    | JsdocObjectPattern
    | JsdocRestElement
    | null;
} | null {
  // See https://github.com/microsoft/TypeScript/blob/0a1aa6d6ebdfa16b82f4a6aaf282089b1d484e05/src/compiler/parser.ts#L7558
  if (state.lookAheadValue(",")) {
    return { node: null };
  }
  return state.tryParse(() => {
    const dotDotDotToken = state.eatValue("...");
    const name = parseIdentifierOrPattern(state);
    if (!name) return null;
    if (dotDotDotToken) {
      return {
        node: {
          type: "RestElement",
          argument: name,
          optional: false,
          loc: {
            start: dotDotDotToken.loc.start,
            end: name.loc.end,
          },
        },
      };
    }
    const initializer = parseInitializer(state);
    if (initializer) {
      return {
        node: {
          type: "AssignmentPattern",
          left: name,
          optional: false,
          right: initializer,
          loc: {
            start: name.loc.start,
            end: (
              initializer as {
                loc: Location;
              }
            ).loc.end,
          },
        },
      };
    }
    return {
      node: name,
    };
  });
}

function parseObjectBindingElement(
  state: ParserState,
): JsdocProperty | JsdocRestElement | null {
  return state.tryParse(() => {
    // See https://github.com/microsoft/TypeScript/blob/0a1aa6d6ebdfa16b82f4a6aaf282089b1d484e05/src/compiler/parser.ts#L7569

    const dotDotDotToken = state.eatValue("...");
    const idToken = state.eat("Identifier");
    if (idToken && !state.lookAheadValue(":")) {
      if (dotDotDotToken) {
        return {
          type: "RestElement",
          argument: identifier(idToken),
          optional: false,
          loc: {
            start: dotDotDotToken.loc.start,
            end: idToken.loc.end,
          },
        };
      }
      // Shorthand identifier
      return {
        type: "Property",
        computed: false,
        key: identifier(idToken),
        kind: "init",
        method: false,
        optional: false,
        shorthand: true,
        value: identifier(idToken),
        loc: {
          start: idToken.loc.start,
          end: idToken.loc.end,
        },
      };
    }
    const propertyName = idToken
      ? identifier(idToken)
      : parsePropertyName(state);
    const computedPropertyName = propertyName
      ? null
      : parseComputedPropertyName(state);
    if ((!propertyName && !computedPropertyName) || !state.eatValue(":"))
      return null;
    const name = parseIdentifierOrPattern(state);
    if (!name) return null;
    let propertyValue: JsdocProperty["value"] = name;
    const initializer = parseInitializer(state);
    if (initializer) {
      const assignment: JsdocAssignmentPattern = {
        type: "AssignmentPattern",
        left: name,
        optional: false,
        right: initializer,
        loc: {
          start: name.loc.start,
          end: (
            initializer as {
              loc: Location;
            }
          ).loc.end,
        },
      };
      propertyValue = assignment;
    }
    if (propertyName) {
      return {
        type: "Property",
        computed: false,
        key: propertyName,
        kind: "init",
        method: false,
        optional: false,
        shorthand: false,
        value: propertyValue,
        loc: {
          start: propertyName.loc.start,
          end: propertyValue.loc.end,
        },
      } satisfies JsdocProperty;
    }
    return {
      type: "Property",
      computed: true,
      key: computedPropertyName!,
      kind: "init",
      method: false,
      optional: false,
      shorthand: false,
      value: propertyValue,
      loc: {
        start: (
          computedPropertyName! as {
            loc: Location;
          }
        ).loc.start,
        end: propertyValue.loc.end,
      },
    };
  });
}

type PropertyName = JsdocIdentifier | JsdocStringLiteral | JsdocNumberLiteral;

function parsePropertyName(state: ParserState): PropertyName | null {
  return state.tryParse(() => {
    // See https://github.com/microsoft/TypeScript/blob/0a1aa6d6ebdfa16b82f4a6aaf282089b1d484e05/src/compiler/parser.ts#L2713
    const literalToken = state.eat("String") || state.eat("Numeric");
    if (literalToken) {
      const node = literal(literalToken);
      if (typeof node.value === "bigint") return null;
      return node as JsdocStringLiteral | JsdocNumberLiteral;
    }
    const token = state.eat("Identifier");
    return token && identifier(token);
  });
}

function parseComputedPropertyName(state: ParserState): null {
  return state.tryParse(() => {
    // See https://github.com/microsoft/TypeScript/blob/0a1aa6d6ebdfa16b82f4a6aaf282089b1d484e05/src/compiler/parser.ts#L2732

    // PropertyName [Yield]:
    //      LiteralPropertyName
    //      ComputedPropertyName[?Yield]
    const open = state.eatValue("[");
    if (!open) return null;
    // TODO: Implement expression parsing
    return null;
  });
}

function parseInitializer(state: ParserState): null {
  // See https://github.com/microsoft/TypeScript/blob/0a1aa6d6ebdfa16b82f4a6aaf282089b1d484e05/src/compiler/parser.ts#L5063
  if (!state.eatValue("=")) return null;
  // TODO: Implement initializer parsing
  return null;
}

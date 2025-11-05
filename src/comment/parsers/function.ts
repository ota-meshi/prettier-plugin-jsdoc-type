import type {
  IdentifierToken,
  JsdocTSTypeAnnotation,
  JsdocTSTypeParameter,
  JsdocTSTypeParameterDeclaration,
} from "../ast.js";
import { identifier } from "../node.js";
import type { ParserState } from "../parser-state.js";
import { parseIdentifier } from "./identifier.js";
import { parseDelimitedList } from "./list.js";
import type { ModifierToken } from "./modifiers.js";
import { isModifierKind, parseModifiers } from "./modifiers.js";
import {
  isBindingIdentifierOrPattern,
  parseIdentifierOrPattern,
} from "./pattern.js";
import { isStartOfType, parseType } from "./type.js";

export function parseFunctionOrConstructorType(
  state: ParserState,
): JsdocTSFunctionType {
  return state.tryParse(() => {
    // See https://github.com/microsoft/TypeScript/blob/0a1aa6d6ebdfa16b82f4a6aaf282089b1d484e05/src/compiler/parser.ts#L4507
    const modifiers = parseModifiersForConstructorType(state);
    const newToken = state.eatValue("new");
    const typeParameters = parseTypeParameters(state);
    const parameters = parseParameters(SignatureFlags.Type);
    const type = parseReturnType(
      SyntaxKind.EqualsGreaterThanToken,
      /* isType */ false,
    );
    const node = newToken
      ? factory.createConstructorTypeNode(
          modifiers,
          typeParameters,
          parameters,
          type,
        )
      : factory.createFunctionTypeNode(typeParameters, parameters, type);
    return withJSDoc(finishNode(node, pos), hasJSDoc);
  });
}

export function isStartOfFunctionTypeOrConstructorType(
  state: ParserState,
): boolean {
  // See https://github.com/microsoft/TypeScript/blob/0a1aa6d6ebdfa16b82f4a6aaf282089b1d484e05/src/compiler/parser.ts#L4850
  if (state.lookAheadValue("<")) {
    return true;
  }
  if (
    state.lookAhead(() => {
      if (!state.eatValue("(")) return false;
      return isUnambiguouslyStartOfFunctionType(state);
    })
  ) {
    return true;
  }
  return (
    state.lookAheadValue("new") ||
    state.lookAhead(() =>
      Boolean(state.eatValue("abstract") && state.lookAheadValue("new")),
    )
  );
}

export function isStartOfParameter(
  state: ParserState,
  isJSDocParameter: boolean,
): boolean {
  // See https://github.com/microsoft/TypeScript/blob/0a1aa6d6ebdfa16b82f4a6aaf282089b1d484e05/src/compiler/parser.ts#L3992
  if (state.lookAheadValue("...")) return true;
  return (
    isBindingIdentifierOrPattern(state) ||
    isModifierKind(state) ||
    isStartOfType(state, /* inStartOfParameter */ !isJSDocParameter)
  );
}

function parseModifiersForConstructorType(state: ParserState): ModifierToken[] {
  // See https://github.com/microsoft/TypeScript/blob/0a1aa6d6ebdfa16b82f4a6aaf282089b1d484e05/src/compiler/parser.ts#L4496

  const abstractToken = state.eatValue("abstract");
  return abstractToken ? [abstractToken] : [];
}

function parseTypeParameters(
  state: ParserState,
): JsdocTSTypeParameterDeclaration | null {
  // See https://github.com/microsoft/TypeScript/blob/0a1aa6d6ebdfa16b82f4a6aaf282089b1d484e05/src/compiler/parser.ts#L3986
  const lessThanToken = state.eatValue("<");
  if (!lessThanToken) return null;
  const params = parseDelimitedList(state, ">", parseTypeParameter);
  if (!params) return null;
  return {
    type: "TSTypeParameterDeclaration",
    params: params.elements,
    loc: {
      start: lessThanToken.loc.start,
      end: params.close.loc.end,
    },
  };
}

function parseTypeParameter(state: ParserState): JsdocTSTypeParameter | null {
  // See https://github.com/microsoft/TypeScript/blob/0a1aa6d6ebdfa16b82f4a6aaf282089b1d484e05/src/compiler/parser.ts#L3954
  const modifiers =
    parseModifiers(state, /* permitConstAsModifier */ true) || [];
  const name = state.eat("Identifier");
  if (!name) return null;
  const extendsKeyword = state.eatValue("extends");
  let constraint: JsdocTSTypeAnnotation | null = null;
  if (extendsKeyword) {
    // It's not uncommon for people to write improper constraints to a generic.  If the
    // user writes a constraint that is an expression and not an actual type, then parse
    // it out as an expression (so we can recover well), but report that a type is needed
    // instead.
    if (isStartOfType(state)) {
      constraint = parseType(state);
    }
  }

  const defaultType = state.eatValue("=") ? parseType(state) : null;
  const node: JsdocTSTypeParameter = {
    type: "TSTypeParameter",
    const: modifiers.some((m) => m.value === "const"),
    constraint,
    default: defaultType,
    in: modifiers.some((m) => m.value === "in"),
    name: identifier(name),
    out: modifiers.some((m) => m.value === "out"),
    loc: {
      start: name.loc.start,
      end: (defaultType || name).loc.end,
    },
  };
  return node;
}

function isUnambiguouslyStartOfFunctionType(state: ParserState): boolean {
  // See https://github.com/microsoft/TypeScript/blob/0a1aa6d6ebdfa16b82f4a6aaf282089b1d484e05/src/compiler/parser.ts#L4879
  if (state.lookAheadValue(")") || state.lookAheadValue("...")) {
    // ( )
    // ( ...
    return true;
  }
  return state.lookAhead(() => {
    if (skipParameterStart(state)) {
      // We successfully skipped modifiers (if any) and an identifier or binding pattern,
      // now see if we have something that indicates a parameter declaration
      if (
        state.lookAheadValue(":") ||
        state.lookAheadValue(",") ||
        state.lookAheadValue("?") ||
        state.lookAheadValue("=")
      ) {
        // ( xxx :
        // ( xxx ,
        // ( xxx ?
        // ( xxx =
        return true;
      }
      if (state.eatValue(")")) {
        if (state.lookAheadValue("=>")) {
          // ( xxx ) =>
          return true;
        }
      }
    }
    return false;
  });
}

function skipParameterStart(state: ParserState): boolean {
  // See https://github.com/microsoft/TypeScript/blob/0a1aa6d6ebdfa16b82f4a6aaf282089b1d484e05/src/compiler/parser.ts#L4861
  if (isModifierKind(state)) {
    // Skip modifiers
    parseModifiers(state);
  }
  if (state.eat("Identifier")) {
    return true;
  }
  if (state.lookAheadValue("[") || state.lookAheadValue("{")) {
    // Return true if we can parse an array or object binding pattern with no errors
    return Boolean(parseIdentifierOrPattern(state));
  }
  return false;
}

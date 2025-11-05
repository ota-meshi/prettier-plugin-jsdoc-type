import type {
  JsdocNamepathType,
  JsdocOptionalType,
  JsdocTSTypePredicate,
  JsdocTSTypeAnnotation,
  JsdocVariadicType,
  Token,
} from "../ast.js";
import type { ParserState } from "../parser-state.js";
import {
  isStartOfFunctionTypeOrConstructorType,
  isStartOfParameter,
  parseFunctionOrConstructorType,
} from "./function.js";
import { parseIdentifier } from "./identifier.js";

export function parseTypeAnnotationRoot(
  state: ParserState,
):
  | JsdocNamepathType
  | JsdocVariadicType
  | JsdocOptionalType
  | JsdocTSTypeAnnotation
  | JsdocTSTypePredicate
  | null {
  const module = state.eatValue("module");
  if (module) {
    // See https://github.com/microsoft/TypeScript/blob/0a1aa6d6ebdfa16b82f4a6aaf282089b1d484e05/src/compiler/parser.ts#L3912
    let lastToken: Token = module;
    for (;;) {
      let nextToken: Token | null;
      if (
        state.lookAheadValue(",") ||
        state.lookAheadValue("}") ||
        !(nextToken = state.advance())
      ) {
        return {
          type: "JsdocNamepathType",
          loc: {
            start: module.loc.start,
            end: lastToken.loc.end,
          },
        };
      }
      lastToken = nextToken;
    }
  }

  // See https://github.com/microsoft/TypeScript/blob/0a1aa6d6ebdfa16b82f4a6aaf282089b1d484e05/src/compiler/parser.ts#L3932
  const dotDotDot = state.eatValue("...");

  const typeAnnotation = parseTypeOrTypePredicate(state);
  if (!typeAnnotation) return null;

  if (dotDotDot) {
    return {
      type: "JsdocVariadicType",
      typeAnnotation,
      loc: {
        start: dotDotDot.loc.start,
        end: typeAnnotation.loc.end,
      },
    };
  }

  // See https://github.com/microsoft/TypeScript/blob/0a1aa6d6ebdfa16b82f4a6aaf282089b1d484e05/src/compiler/parser.ts#L3938
  const eqToken = state.eatValue("=");
  if (eqToken) {
    return {
      type: "JsdocOptionalType",
      typeAnnotation: typeAnnotation.typeAnnotation,
      loc: {
        start: typeAnnotation.loc.start,
        end: eqToken.loc.end,
      },
    };
  }

  return typeAnnotation;
}

function parseTypeOrTypePredicate(
  state: ParserState,
): JsdocTSTypeAnnotation | JsdocTSTypePredicate | null {
  // See https://github.com/microsoft/TypeScript/blob/0a1aa6d6ebdfa16b82f4a6aaf282089b1d484e05/src/compiler/parser.ts#L4910
  const typePredicateVariable = state.tryParse(parseTypePredicatePrefix);
  const typeAnnotation = state.tryParse(parseType);
  if (!typeAnnotation) return null;
  if (typePredicateVariable) {
    return {
      type: "TSTypePredicate",
      asserts: false,
      parameterName: typePredicateVariable,
      typeAnnotation,
      loc: {
        start: typePredicateVariable.loc.start,
        end: typeAnnotation.loc.end,
      },
    };
  }

  return typeAnnotation;
}

function parseTypePredicatePrefix(state: ParserState) {
  // See https://github.com/microsoft/TypeScript/blob/0a1aa6d6ebdfa16b82f4a6aaf282089b1d484e05/src/compiler/parser.ts#L4922
  const id = parseIdentifier(state);
  if (!id) return null;
  const isToken = state.eatValue("is");
  if (!isToken || id.loc.end.line !== isToken.loc.start.line) return null;
  return id;
}

export function parseType(state: ParserState): JsdocTSTypeAnnotation | null {
  // See https://github.com/microsoft/TypeScript/blob/0a1aa6d6ebdfa16b82f4a6aaf282089b1d484e05/src/compiler/parser.ts#L4938

  if (isStartOfFunctionTypeOrConstructorType(state)) {
    return parseFunctionOrConstructorType(state);
  }
  const pos = getNodePos();
  const type = parseUnionTypeOrHigher();
  if (
    !inDisallowConditionalTypesContext() &&
    !scanner.hasPrecedingLineBreak() &&
    parseOptional(SyntaxKind.ExtendsKeyword)
  ) {
    // The type following 'extends' is not permitted to be another conditional type
    const extendsType = disallowConditionalTypesAnd(parseType);
    parseExpected(SyntaxKind.QuestionToken);
    const trueType = allowConditionalTypesAnd(parseType);
    parseExpected(SyntaxKind.ColonToken);
    const falseType = allowConditionalTypesAnd(parseType);
    return finishNode(
      factory.createConditionalTypeNode(type, extendsType, trueType, falseType),
      pos,
    );
  }
  return type;
}

export function isStartOfType(
  state: ParserState,
  inStartOfParameter?: boolean,
): boolean {
  if (
    state.lookAheadValue("any") ||
    state.lookAheadValue("unknown") ||
    state.lookAheadValue("string") ||
    state.lookAheadValue("number") ||
    state.lookAheadValue("bigInt") ||
    state.lookAheadValue("boolean") ||
    state.lookAheadValue("readonly") ||
    state.lookAheadValue("symbol") ||
    state.lookAheadValue("unique") ||
    state.lookAheadValue("void") ||
    state.lookAheadValue("undefined") ||
    state.lookAheadValue("null") ||
    state.lookAheadValue("this") ||
    state.lookAheadValue("typeOf") ||
    state.lookAheadValue("never") ||
    state.lookAheadValue("{") ||
    state.lookAheadValue("[") ||
    state.lookAheadValue("<") ||
    state.lookAheadValue("|") ||
    state.lookAheadValue("&") ||
    state.lookAheadValue("new") ||
    state.lookAhead(() =>
      Boolean(state.eat("String") || state.eat("Numeric")),
    ) ||
    state.lookAheadValue("true") ||
    state.lookAheadValue("false") ||
    state.lookAheadValue("object") ||
    state.lookAheadValue("*") ||
    state.lookAheadValue("?") ||
    state.lookAheadValue("!") ||
    state.lookAheadValue("...") ||
    state.lookAheadValue("infer") ||
    state.lookAheadValue("import") ||
    state.lookAheadValue("asserts") ||
    state.lookAhead(() => Boolean(state.eat("Template")))
  )
    return true;
  if (state.lookAheadValue("function")) {
    return !inStartOfParameter;
  }
  if (
    state.lookAhead(() => Boolean(state.eatValue("-") && state.eat("Numeric")))
  ) {
    return !inStartOfParameter;
  }
  if (
    state.lookAhead(() =>
      Boolean(
        state.eatValue("(") && isStartOfParenthesizedOrFunctionType(state),
      ),
    )
  ) {
    return !inStartOfParameter;
  }

  return state.lookAhead(() => state.eat("Identifier"));
}

function isStartOfParenthesizedOrFunctionType(state: ParserState) {
  // See https://github.com/microsoft/TypeScript/blob/0a1aa6d6ebdfa16b82f4a6aaf282089b1d484e05/src/compiler/parser.ts#L4709
  return (
    state.lookAheadValue(")") ||
    state.lookAhead(() => {
      return (
        isStartOfParameter(state, /* isJSDocParameter */ false) ||
        isStartOfType(state)
      );
    })
  );
}

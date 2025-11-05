import type { IdentifierToken } from "../ast.js";
import type { ParserState } from "../parser-state.js";

type ModifierKind =
  | "abstract"
  | "accessor"
  | "async"
  | "const"
  | "declare"
  | "default"
  | "export"
  | "in"
  | "private"
  | "protected"
  | "public"
  | "out"
  | "override"
  | "readonly"
  | "static";

export const MODIFIER_KINDS: ModifierKind[] = [
  "abstract",
  "accessor",
  "async",
  "const",
  "declare",
  "default",
  "export",
  "in",
  "public",
  "private",
  "protected",
  "readonly",
  "static",
  "out",
  "override",
];

export type ModifierToken = IdentifierToken & { value: ModifierKind };

export function isModifierKind(state: ParserState): boolean {
  return state.lookAhead(() =>
    MODIFIER_KINDS.some((kind) => state.eatValue(kind)),
  );
}

export function parseModifiers(
  state: ParserState,
  permitConstAsModifier = false,
): ModifierToken[] | null {
  // See https://github.com/microsoft/TypeScript/blob/0a1aa6d6ebdfa16b82f4a6aaf282089b1d484e05/src/compiler/parser.ts#L7986
  const list: ModifierToken[] = [];
  let hasSeenStaticModifier = false;

  let modifier;
  while (
    (modifier = tryParseModifier(
      state,
      hasSeenStaticModifier,
      permitConstAsModifier,
    ))
  ) {
    if (modifier.value === "static") hasSeenStaticModifier = true;
    list.push(modifier);
  }

  return list.length ? list : null;
}

function tryParseModifier(
  state: ParserState,
  hasSeenStaticModifier: boolean,
  permitConstAsModifier?: boolean,
): ModifierToken | null {
  return state.tryParse(() => {
    // See https://github.com/microsoft/TypeScript/blob/0a1aa6d6ebdfa16b82f4a6aaf282089b1d484e05/src/compiler/parser.ts#L7953
    let token: ModifierToken | null = null;
    for (const kind of MODIFIER_KINDS) {
      if ((token = state.eatValue(kind))) break;
    }

    if (token!.value === "const" && permitConstAsModifier) {
      // We need to ensure that any subsequent modifiers appear on the same line
      // so that when 'const' is a standalone declaration, we don't issue an error.
      if (!state.lookAhead(nextTokenIsOnSameLineAndCanFollowModifier)) {
        return null;
      }
    } else if (hasSeenStaticModifier && token!.value === "static") {
      return null;
    } else if (!parseAnyContextualModifier(state)) {
      return null;
    }

    return token!;
  });
}

function parseAnyContextualModifier(state: ParserState): boolean {
  // See https://github.com/microsoft/TypeScript/blob/0a1aa6d6ebdfa16b82f4a6aaf282089b1d484e05/src/compiler/parser.ts#L2806
  return (
    isModifierKind(state) &&
    (state.tryParse(nextTokenCanFollowModifier) || false)
  );
}

function nextTokenIsOnSameLineAndCanFollowModifier(
  state: ParserState,
): boolean {
  const lastToken = state.tokens.at(-1);
  if (lastToken?.loc.end.line !== state.next?.loc.start.line) {
    return false;
  }
  return canFollowModifier(state);
}

function canFollowModifier(state: ParserState): boolean {
  return (
    state.lookAheadValue("[") ||
    state.lookAheadValue("{") ||
    state.lookAheadValue("*") ||
    state.lookAheadValue("...") ||
    isLiteralPropertyName(state)
  );
}

function canFollowGetOrSetKeyword(state: ParserState): boolean {
  return state.lookAheadValue("{") || isLiteralPropertyName(state);
}

function isLiteralPropertyName(state: ParserState): boolean {
  return state.lookAhead(() => {
    return Boolean(
      state.eat("Identifier") || state.eat("String") || state.eat("Numeric"),
    );
  });
}

function nextTokenCanFollowModifier(state: ParserState) {
  // See https://github.com/microsoft/TypeScript/blob/0a1aa6d6ebdfa16b82f4a6aaf282089b1d484e05/src/compiler/parser.ts#L2766
  if (state.eatValue("static")) {
    return canFollowModifier(state);
  }
  if (state.eatValue("get") || state.eatValue("set")) {
    return canFollowGetOrSetKeyword(state);
  }
  return nextTokenIsOnSameLineAndCanFollowModifier(state);
}

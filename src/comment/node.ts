import type {
  IdentifierToken,
  JsdocBigIntLiteral,
  JsdocIdentifier,
  JsdocNumberLiteral,
  JsdocStringLiteral,
  NumericToken,
  StringToken,
} from "./ast.js";

export function identifierOrLiteral(
  token: IdentifierToken | StringToken,
): JsdocIdentifier | JsdocStringLiteral {
  return token.type === "Identifier" ? identifier(token) : literal(token);
}
export function identifier(token: IdentifierToken): JsdocIdentifier {
  return {
    type: "Identifier",
    name: parseText(token.value),
    loc: token.loc,
  };
}
export function literal(token: StringToken): JsdocStringLiteral;
export function literal(
  token: NumericToken,
): JsdocNumberLiteral | JsdocBigIntLiteral;
export function literal(
  token: StringToken | NumericToken,
): JsdocStringLiteral | JsdocNumberLiteral | JsdocBigIntLiteral;
export function literal(
  token: StringToken | NumericToken,
): JsdocStringLiteral | JsdocNumberLiteral | JsdocBigIntLiteral {
  if (token.type === "String") {
    return {
      type: "Literal",
      value: parseText(token.value.slice(1, -1)),
      raw: token.value,
      loc: token.loc,
    };
  }
  if (token.value.endsWith("n")) {
    return {
      type: "Literal",
      value: BigInt(token.value.slice(0, -1)),
      raw: token.value,
      loc: token.loc,
    };
  }
  return {
    type: "Literal",
    value: Number(token.value),
    raw: token.value,
    loc: token.loc,
  };
}

function parseText(value: string): string {
  let str = "";
  for (let index = 0; index < value.length; ) {
    const c = value[index];
    if (c === "\\") {
      const parsed = parseEscapedChar(value, index);
      if (parsed) {
        str += parsed.c;
        index = parsed.index;
        continue;
      }
    }
    str += c;
    index++;
  }
  return str;
}

const ESCAPE_PARSERS: Partial<
  Record<
    string,
    (index: number, value: string) => { c: string; index: number } | null
  >
> = {
  n: (index) => ({ c: "\n", index: index + 1 }),
  r: (index) => ({ c: "\r", index: index + 1 }),
  t: (index) => ({ c: "\t", index: index + 1 }),
  b: (index) => ({ c: "\b", index: index + 1 }),
  f: (index) => ({ c: "\f", index: index + 1 }),
  v: (index) => ({ c: "\v", index: index + 1 }),
  x: (index, value) => {
    const re = /\p{Hex_Digit}{1,2}/uy;
    re.lastIndex = index;
    const hexStr = re.exec(value)?.[0];
    if (!hexStr) return null;
    const hex = parseInt(hexStr, 16);
    return { c: String.fromCharCode(hex), index: index + hexStr.length };
  },
  u: (index, value) => {
    if (value[index] === "{") {
      const re = /\p{Hex_Digit}+/uy;
      re.lastIndex = index + 1;
      const hexStr = re.exec(value)?.[0];
      if (!hexStr) return null;
      const hex = parseInt(hexStr, 16);
      const nextIndex = index + 1 + hexStr.length;
      if (value[nextIndex] !== "}") return null;
      return { c: String.fromCharCode(hex), index: nextIndex + 1 };
    }
    const re = /\p{Hex_Digit}{1,4}/uy;
    re.lastIndex = index;
    const hexStr = re.exec(value)?.[0];
    if (!hexStr) return null;
    const hex = parseInt(hexStr, 16);
    return { c: String.fromCharCode(hex), index: index + hexStr.length };
  },
  8: () => null,
  9: () => null,
};

function parseEscapedChar(
  value: string,
  escapeIndex: number,
): { c: string; index: number } | null {
  const index = escapeIndex + 1;
  const c = value[index];
  const parser = ESCAPE_PARSERS[c];
  if (parser) return parser(index + 1, value);
  if ("0" <= c && c <= "7") {
    const re = /[0-7]{1,3}/uy;
    re.lastIndex = index;
    let octStr = re.exec(value)?.[0];
    if (!octStr) return null;
    let oct = parseInt(octStr, 8);
    if (oct > 255) {
      octStr = octStr.slice(0, -1);
      oct = parseInt(octStr, 8);
    }
    const nextIndex = index + octStr.length;
    const next = value[nextIndex];
    if (octStr !== "0" || next === "8" || next === "9") return null;
    return { c: String.fromCharCode(oct), index: nextIndex };
  }
  return { c, index: index + 1 };
}

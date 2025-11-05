import type { Position, TemplateToken, Token } from "./ast.js";
import type { Lines } from "./lines.js";

type TokenBuilder = (lines: Lines, pos: Position, state: State) => Token | null;
const PUNCTUATOR_CHARACTERS = new Set([
  "(",
  ")",
  "{",
  "}",
  "[",
  "]",
  "|",
  "&",
  "<",
  ">",
  ",",
  ";",
  "*",
  "?",
  "!",
  "=",
  ":",
  ".",
  "#",
  "~",
  "/",
  "@",
  "-",
  "+",
]);
const RE_WHITESPACE = /\s+/uy;
const RE_TEMPLATE_CONTINUE = /(?:[^$\\`]|\\[\s\S])*(?:`|\$\{|$)/uy;
const TOKEN_BUILDERS: TokenBuilder[] = [
  // Identifier
  regexpToTokenBuilder(
    /[\p{ID_Start}$\\_](?:[\p{ID_Continue}$\u200c\u200d]|\\u\p{Hex_Digit}{4}|\\u\{\p{Hex_Digit}+\})*/uy,
    "Identifier",
  ),
  // String
  regexpToTokenBuilder(
    /(?<quote>["'])(?:[^\n\r"'\\]|(?!\k<quote>)["']|\\(?:\r\n|[\s\S]))*\k<quote>/uy,
    "String",
  ),
  // Hexadecimal / Octal / Binary
  regexpToTokenBuilder(/0[Xx]\p{Hex_Digit}(?:_?\p{Hex_Digit})*n?/uy, "Numeric"),
  regexpToTokenBuilder(/0[Oo][0-7](?:_?[0-7])*n?/uy, "Numeric"),
  regexpToTokenBuilder(/0[Bb][01](?:_?[01])*n?/uy, "Numeric"),
  // BigInt
  regexpToTokenBuilder(/0n/uy, "Numeric"),
  regexpToTokenBuilder(/[1-9](?:_?\d)*n/uy, "Numeric"),
  // Number
  regexpToTokenBuilder(
    /(?:(?:0|[1-9](?:_?\d)*)(?:\.(?:\d(?:_?\d)*)?)?|\.\d(?:_?\d)*)(?:e[+-]?\d(?:_?\d)*)?/iuy,
    "Numeric",
  ),
  // Template leading element
  (lines, pos, state) => {
    const line = lines.getLine(pos.line)!;
    if (line[pos.column] !== "`") return null;
    state.templateStack = {
      upper: state.templateStack,
      braces: [],
    };
    return readTemplateToken(lines, pos, state);
  },
  // Template Element
  (lines, pos, state) => {
    if (!state.templateStack || state.templateStack.braces.length) return null;
    const line = lines.getLine(pos.line)!;
    if (line[pos.column] !== "}") return null;
    return readTemplateToken(lines, pos, state);
  },
  stringToTokenBuilder("...", "Punctuator"),
  stringToTokenBuilder("=>", "Punctuator"),
  // Punctuator characters
  (lines, pos, state) => {
    const c = lines.getLine(pos.line)![pos.column];
    if (!PUNCTUATOR_CHARACTERS.has(c)) return null;

    if (c === "{") {
      state.templateStack?.braces.push(pos);
    } else if (c === "}") {
      state.templateStack?.braces.pop();
    }

    return {
      type: "Punctuator",
      value: c,
      loc: {
        start: pos,
        end: { line: pos.line, column: pos.column + 1 },
      },
    };
  },
];

function stringToTokenBuilder(text: string, type: Token["type"]): TokenBuilder {
  return (lines, pos) => {
    if (!lines.getLine(pos.line)!.startsWith(text, pos.column)) return null;
    return {
      type,
      value: text,
      loc: {
        start: pos,
        end: { line: pos.line, column: pos.column + text.length },
      },
    };
  };
}

function regexpToTokenBuilder(re: RegExp, type: Token["type"]): TokenBuilder {
  return (lines, pos) => {
    re.lastIndex = pos.column;
    const value = re.exec(lines.getLine(pos.line)!)?.[0];
    if (!value) return null;
    return {
      type,
      value,
      loc: {
        start: pos,
        end: { line: pos.line, column: pos.column + value.length },
      },
    };
  };
}

function readTemplateToken(
  lines: Lines,
  pos: Position,
  state: State,
): TemplateToken | null {
  let lineNumber = pos.line;
  let column = pos.column + 1;
  let line: string | null;
  const value = [];
  while ((line = lines.getLine(lineNumber))) {
    RE_TEMPLATE_CONTINUE.lastIndex = pos.column + 1;
    const match = RE_TEMPLATE_CONTINUE.exec(line)?.[0];
    if (!match) return null;
    value.push(match);
    const closed = match.endsWith("`");
    if (closed || match.endsWith("${")) {
      if (closed) {
        state.templateStack = state.templateStack!.upper;
      }
      return {
        type: "Template",
        value: value.join("\n"),
        loc: {
          start: pos,
          end: { line: lineNumber, column: column + match.length },
        },
      };
    }
    lineNumber++;
    column = 0;
  }
  return null;
}

type TemplateStack = {
  upper?: TemplateStack;
  braces: Position[];
};
class State {
  public templateStack: TemplateStack | undefined;
}

export class Tokenizer {
  private pos: Position = { line: 1, column: 0 };

  private readonly state = new State();

  public readonly tokens: Token[] = [];

  public readonly buffer: Token[] = [];

  private readonly lines: Lines;

  public constructor(lines: Lines) {
    this.lines = lines;
  }

  public [Symbol.iterator](): Iterator<Token> {
    return {
      next: () => {
        const token = this.next();
        return token
          ? { done: false, value: token }
          : { done: true, value: null };
      },
    };
  }

  public next(): Token | null {
    if (this.buffer.length) {
      const token = this.buffer.shift()!;
      this.tokens.push(token);
      return token;
    }
    for (;;) {
      const line = this.pos.line;
      const text = this.lines.getLine(line);
      if (text == null) return null;

      // Skip whitespace
      RE_WHITESPACE.lastIndex = this.pos.column;
      const whitespace = RE_WHITESPACE.exec(text)?.[0];
      if (whitespace) {
        this.pos = { line, column: this.pos.column + whitespace.length };
      }

      if (text.length <= this.pos.column) {
        this.pos = { line: line + 1, column: 0 };
        continue;
      } else {
        break;
      }
    }
    for (const builder of TOKEN_BUILDERS) {
      const token = builder(this.lines, this.pos, this.state);
      if (!token) continue;
      this.pos = { ...token.loc.end };
      this.tokens.push(token);
      return token;
    }
    return null;
  }

  public lookAhead(): Token | null {
    if (this.buffer.length) return this.buffer[0];
    const token = this.next();
    if (token) {
      this.back(token);
    }
    return token;
  }

  public back(token: Token): void {
    const index = this.tokens.lastIndexOf(token);
    if (index === -1) {
      throw new Error("Cannot back token");
    }
    const tokens = this.tokens.splice(index);
    this.buffer.unshift(...tokens);
  }
}

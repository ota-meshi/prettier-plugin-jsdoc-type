import type {
  IdentifierToken,
  Keyword,
  Punctuator,
  PunctuatorToken,
  Token,
} from "./ast.js";
import type { Tokenizer } from "./tokenizer.js";

export class ParserState {
  public readonly tokenizer: Tokenizer;

  public next: Token | null = null;

  public constructor(tokenizer: Tokenizer) {
    this.tokenizer = tokenizer;
    this.advance();
  }

  public get tokens(): Token[] {
    const tokens = [...this.tokenizer.tokens];
    if (this.next && tokens[tokens.length - 1] === this.next) tokens.pop();
    return tokens;
  }

  public eat<T extends Token["type"]>(
    type: T,
  ): Extract<Token, { type: T }> | null {
    if (this.next?.type !== type) return null;
    const result = this.next;
    this.advance();
    return result as Extract<Token, { type: T }>;
  }

  public eatValue<V extends Keyword>(
    value: V,
  ): (IdentifierToken & { value: V }) | null;

  public eatValue(value: Punctuator): PunctuatorToken | null;

  public eatValue(
    value: Keyword | Punctuator,
  ): PunctuatorToken | IdentifierToken | null {
    if (this.next?.value !== value) return null;
    const result = this.next;
    this.advance();
    return result as PunctuatorToken | IdentifierToken;
  }

  public lookAheadValue(value: Keyword | Punctuator): boolean {
    return this.next?.value === value;
  }

  public advance(): Token | null {
    return (this.next = this.tokenizer.next());
  }

  public tryParse<T>(fn: (state: ParserState) => null | T): T | null {
    const token = this.next;
    if (!token) return null;
    const t = fn(this);
    if (t != null) return t;
    this.tokenizer.back(token);
    this.advance();
    return null;
  }

  public lookAhead(
    fn: (state: ParserState) => boolean | Token | null,
  ): boolean {
    const token = this.next;
    if (!token) return false;
    const result = fn(this);
    this.tokenizer.back(token);
    this.advance();
    return Boolean(result);
  }
}

export type Position = {
  line: number;
  /** The offset position within the `type` text. */
  column: number;
};
export type Location = {
  start: Position;
  end: Position;
};
type HasLocation = {
  loc: Location;
};
export type JsdocImportTagType = HasLocation & {
  type: "JsdocImportTagType";
  specifiers: (
    | JsdocImportTagTypeImportSpecifier
    | JsdocImportTagTypeImportDefaultSpecifier
    | JsdocImportTagTypeImportNamespaceSpecifier
  )[];
  source: JsdocStringLiteral;
  attributes: JsdocImportTagTypeImportAttribute[];
  tokens: Token[];
};
export type JsdocImportTagTypeImportSpecifier = HasLocation & {
  type: "ImportSpecifier";
  imported: JsdocIdentifier | JsdocStringLiteral;
  importKind: "type" | "value";
  local: JsdocIdentifier;
};
export type JsdocImportTagTypeImportDefaultSpecifier = HasLocation & {
  type: "ImportDefaultSpecifier";
  local: JsdocIdentifier;
};
export type JsdocImportTagTypeImportNamespaceSpecifier = HasLocation & {
  type: "ImportNamespaceSpecifier";
  local: JsdocIdentifier;
};
export type JsdocImportTagTypeImportAttribute = HasLocation & {
  type: "ImportAttribute";
  key: JsdocIdentifier | JsdocStringLiteral;
  value: JsdocStringLiteral;
};
export type JsdocStringLiteral = HasLocation & {
  type: "Literal";
  value: string;
  raw: string;
};
export type JsdocIdentifier = HasLocation & {
  type: "Identifier";
  name: string;
};

export type IdentifierToken = BaseToken<"Identifier">;
export type StringToken = BaseToken<"String">;
export type PunctuatorToken = BaseToken<"Punctuator">;
export type Token = IdentifierToken | StringToken | PunctuatorToken;
type BaseToken<T extends string> = HasLocation & {
  type: T;
  value: string;
};

export function identifierOrLiteral(
  token: IdentifierToken | StringToken,
): JsdocIdentifier | JsdocStringLiteral {
  return token.type === "Identifier" ? identifier(token) : literal(token);
}
export function identifier(token: IdentifierToken): JsdocIdentifier {
  return {
    type: "Identifier",
    name: token.value,
    loc: token.loc,
  };
}
export function literal(token: StringToken): JsdocStringLiteral {
  return {
    type: "Literal",
    value: token.value.slice(1, -1),
    raw: token.value,
    loc: token.loc,
  };
}

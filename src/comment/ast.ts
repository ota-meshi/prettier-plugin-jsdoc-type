export type Keyword =
  | "type"
  | "as"
  | "from"
  | "with"
  | "module"
  | "is"
  | "abstract"
  | "accessor"
  | "async"
  | "const"
  | "declare"
  | "default"
  | "export"
  | "in"
  | "public"
  | "private"
  | "protected"
  | "readonly"
  | "static"
  | "out"
  | "override"
  | "get"
  | "set"
  | "new"
  | "extends"
  | "any"
  | "unknown"
  | "string"
  | "number"
  | "bigInt"
  | "boolean"
  | "readonly"
  | "symbol"
  | "unique"
  | "void"
  | "undefined"
  | "null"
  | "this"
  | "typeOf"
  | "never"
  | "true"
  | "false"
  | "object"
  | "infer"
  | "import"
  | "asserts"
  | "function";
export type Punctuator =
  | "("
  | ")"
  | "{"
  | "}"
  | "["
  | "]"
  | "|"
  | "&"
  | "<"
  | ">"
  | ","
  | ";"
  | "*"
  | "?"
  | "!"
  | "="
  | ":"
  | "."
  | "#"
  | "~"
  | "/"
  | "@"
  | "+"
  | "-"
  | "..."
  | "=>";
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
export type JsdocTypeExpression = HasLocation & {
  type: "JsdocTypeExpression";
  typeAnnotation:
    | JsdocNamepathType
    | JsdocVariadicType
    | JsdocOptionalType
    | JsdocTSTypeAnnotation
    | JsdocTSTypePredicate;
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
export type JsdocNumberLiteral = HasLocation & {
  type: "Literal";
  value: number;
  raw: string;
};
export type JsdocBigIntLiteral = HasLocation & {
  type: "Literal";
  value: bigint;
  raw: string;
};
export type JsdocLiteral =
  | JsdocStringLiteral
  | JsdocNumberLiteral
  | JsdocBigIntLiteral;
export type JsdocIdentifier = HasLocation & {
  type: "Identifier";
  name: string;
};
export type JsdocTSTypeAnnotation = HasLocation & {
  type: "TSTypeAnnotation";
  typeAnnotation: JsdocTypeNode;
};
/** {module:x} */
export type JsdocNamepathType = HasLocation & {
  type: "JsdocNamepathType";
};
/** {...x} */
export type JsdocVariadicType = HasLocation & {
  type: "JsdocVariadicType";
  typeAnnotation: JsdocTypeNode;
};
/** {x=} */
export type JsdocOptionalType = HasLocation & {
  type: "JsdocOptionalType";
  typeAnnotation: JsdocTSTypeAnnotation;
};
/** {x is e} */
export type JsdocTSTypePredicate = HasLocation & {
  type: "TSTypePredicate";
  asserts: boolean;
  parameterName: JsdocIdentifier | JsdocTSThisType;
  typeAnnotation: JsdocTSTypeAnnotation | null;
};
/** {this} */
export type JsdocTSThisType = HasLocation & {
  type: "TSThisType";
};

type TSFunctionSignatureBase = HasLocation & {
  params: Parameter[];
  returnType?: JsdocTSTypeAnnotation;
  typeParameters?: JsdocTSTypeParameterDeclaration;
};
export type JsdocTSFunctionType = TSFunctionSignatureBase & {
  type: "TSFunctionType";
};
export type JsdocTSTypeParameterDeclaration = HasLocation & {
  type: "TSTypeParameterDeclaration";
  params: JsdocTSTypeParameter[];
};
export type JsdocTSTypeParameter = HasLocation & {
  type: "TSTypeParameter";
  const: boolean;
  constraint: JsdocTypeNode | undefined;
  default: JsdocTypeNode | undefined;
  in: boolean;
  name: JsdocIdentifier;
  out: boolean;
};
export type JsdocTypeNode =
  | JsdocTSAbstractKeyword
  | JsdocTSAnyKeyword
  | JsdocTSArrayType
  | JsdocTSAsyncKeyword
  | JsdocTSBigIntKeyword
  | JsdocTSBooleanKeyword
  | JsdocTSConditionalType
  | JsdocTSConstructorType
  | JsdocTSDeclareKeyword
  | JsdocTSExportKeyword
  | JsdocTSFunctionType
  | JsdocTSImportType
  | JsdocTSIndexedAccessType
  | JsdocTSInferType
  | JsdocTSIntersectionType
  | JsdocTSIntrinsicKeyword
  | JsdocJsdocTSLiteralType
  | JsdocTSMappedType
  | JsdocTSNamedTupleMember
  | JsdocTSNeverKeyword
  | JsdocTSNullKeyword
  | JsdocTSNumberKeyword
  | JsdocTSObjectKeyword
  | JsdocTSOptionalType
  | JsdocTSPrivateKeyword
  | JsdocTSProtectedKeyword
  | JsdocTSPublicKeyword
  | JsdocTSQualifiedName
  | JsdocTSReadonlyKeyword
  | JsdocTSRestType
  | JsdocTSStaticKeyword
  | JsdocTSStringKeyword
  | JsdocTSSymbolKeyword
  | JsdocTSTemplateLiteralType
  | JsdocTSThisType
  | JsdocTSTupleType
  | JsdocTSTypeLiteral
  | JsdocTSTypeOperator
  | JsdocTSTypePredicate
  | JsdocTSTypeQuery
  | JsdocTSTypeReference
  | JsdocTSUndefinedKeyword
  | JsdocTSUnionType
  | JsdocTSUnknownKeyword
  | JsdocTSVoidKeyword;

type DestructuringPattern =
  | JsdocArrayPattern
  | JsdocAssignmentPattern
  | JsdocIdentifier
  | JsdocMemberExpression
  | JsdocObjectPattern
  | JsdocRestElement;
export type JsdocArrayPattern = HasLocation & {
  type: "ArrayPattern";
  elements: (DestructuringPattern | null)[];
  optional: boolean;
  typeAnnotation?: JsdocTSTypeAnnotation | null;
};
type JsdocExpression = never;
export type JsdocAssignmentPattern = HasLocation & {
  type: "AssignmentPattern";
  left: JsdocIdentifier | JsdocArrayPattern | JsdocObjectPattern;
  optional: boolean;
  right: JsdocExpression;
  typeAnnotation?: JsdocTSTypeAnnotation;
};
export type JsdocMemberExpression = HasLocation & {
  type: "MemberExpression";
};
export type JsdocObjectPattern = HasLocation & {
  type: "ObjectPattern";
  optional: boolean;
  properties: (JsdocProperty | JsdocRestElement)[];
  typeAnnotation?: JsdocTSTypeAnnotation;
};

export type JsdocPropertyComputedName = HasLocation & {
  type: "Property";
  computed: true;
  key: JsdocExpression;
  kind: "get" | "init" | "set";
  method: false;
  optional: false;
  shorthand: boolean;
  value:
    | JsdocAssignmentPattern
    | JsdocIdentifier
    | JsdocArrayPattern
    | JsdocObjectPattern;
};
export type JsdocPropertyNonComputedName = HasLocation & {
  type: "Property";
  computed: false;
  key: JsdocIdentifier | JsdocNumberLiteral | JsdocStringLiteral;
  kind: "get" | "init" | "set";
  method: false;
  optional: false;
  shorthand: boolean;
  value:
    | JsdocAssignmentPattern
    | JsdocIdentifier
    | JsdocArrayPattern
    | JsdocObjectPattern;
};
export type JsdocProperty =
  | JsdocPropertyComputedName
  | JsdocPropertyNonComputedName;
export type JsdocRestElement = HasLocation & {
  type: "RestElement";
  argument: DestructuringPattern;
  optional: boolean;
  typeAnnotation?: JsdocTSTypeAnnotation;
};

export type IdentifierToken = BaseToken<"Identifier">;
export type StringToken = BaseToken<"String">;
export type NumericToken = BaseToken<"Numeric">;
export type PunctuatorToken = BaseToken<"Punctuator">;
export type TemplateToken = BaseToken<"Template">;
export type Token =
  | IdentifierToken
  | StringToken
  | NumericToken
  | PunctuatorToken
  | TemplateToken;
type BaseToken<T extends string> = HasLocation & {
  type: T;
  value: string;
};

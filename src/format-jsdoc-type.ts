import type { Location, PunctuatorToken, Token } from "./comment/ast.js";
import { TextLines } from "./comment/lines.js";
import { Tokenizer } from "./comment/tokenizer.js";
import type { ParserOptions } from "prettier";
import * as prettier from "prettier";

type Processor = {
  preprocess?: (typeToParse: string) => string;
  postprocess?: (formatted: string) => string | null;
};

export async function formatJSDocType(
  type: string,
  options: ParserOptions,
): Promise<string | null> {
  let typeToParse = type.trim();

  const processors: Processor[] = [];
  try {
    const spread = typeToParse.startsWith("...");
    if (spread) {
      typeToParse = typeToParse.slice(3).trim();
      processors.push({
        postprocess: (formatted) => {
          let result = formatted;
          const preSpaces = /^\s+/u.exec(result)?.[0] || "";
          if (preSpaces) {
            result = result.slice(preSpaces.length);
          }
          if (
            /\s/u.test(result.trim()) &&
            !result.startsWith("(") &&
            !result.endsWith(")")
          ) {
            if (!result.includes("\n")) {
              result = `(${result})`;
            } else {
              const indent = getIndentFromOption(options);
              result = `(\n${indent}${getFirstIndent(result)}${result
                .split("\n")
                .map((s) => `${indent}${s}`)
                .join("\n")}\n)`;
            }
          }
          return `${preSpaces}...${result}`;
        },
      });
    }

    if (/function\s*\(/u.test(typeToParse)) {
      processors.push(transformJSDocFunctionTypeProcessor());
    }

    const optional =
      typeToParse.length > 1 && typeToParse.endsWith("?")
        ? "?"
        : typeToParse.endsWith("=")
          ? "="
          : null;
    if (optional) {
      typeToParse = typeToParse.slice(0, -1).trim();
      processors.push({
        preprocess: (text) => {
          return optional === "=" ? `(${text})?` : `${text}?`;
        },
        postprocess:
          optional === "="
            ? (formatted) => {
                // Replace the last `?` with `=`
                const lastOptional = /\?(\s*)$/u.exec(formatted);
                if (!lastOptional) return null;
                return `${formatted.slice(0, lastOptional.index)}=${lastOptional[1]}`;
              }
            : undefined,
      });
      return postprocess(
        await formatJSDocTypeAsTypeAlias(preprocess(typeToParse), options),
      );
    }

    return postprocess(
      await formatJSDocTypeAsReturnType(preprocess(typeToParse), options),
    );
  } catch {
    return null;
  }

  function preprocess(text: string): string {
    let result: string = text;
    for (const processor of processors) {
      if (!processor.preprocess) continue;
      result = processor.preprocess(result);
    }
    return result;
  }

  function postprocess(formatted: string): string | null {
    let result: string | null = formatted;
    for (const processor of [...processors].reverse()) {
      if (!processor.postprocess) continue;
      result = processor.postprocess(result);
      if (result == null) return null;
    }
    return result;
  }
}

export async function formatJSDocImportType(
  type: string,
  options: ParserOptions,
): Promise<string | null> {
  const trimmedType = type.trim();
  try {
    return await formatJSDocImportType0(trimmedType, options);
  } catch {
    return null;
  }
}

async function formatJSDocTypeAsReturnType(
  type: string,
  options: ParserOptions,
): Promise<string> {
  const formatted = await prettier.format(`function f(): ${type} {}`, {
    ...options,
    parser: "typescript",
    printWidth: (options.printWidth ?? 80) + 15,
  });

  return formatted
    .trim()
    .replace(/^;/u, "")
    .replace(/;$/u, "")
    .trim()
    .replace(/^function\s+f\s*\(\s*\)\s*:[^\S\n]*/u, "")
    .replace(/[^\S\n]*\{\s*\}$/u, "");
}

async function formatJSDocTypeAsTypeAlias(
  type: string,
  options: ParserOptions,
): Promise<string> {
  const formatted = await prettier.format(`type A = ${type}`, {
    ...options,
    parser: "typescript",
    printWidth: (options.printWidth ?? 80) + 10,
  });

  return formatted
    .trim()
    .replace(/^;/u, "")
    .replace(/;$/u, "")
    .trim()
    .replace(/^type\s+A\s*=[^\S\n]*/u, "")
    .replace(/[^\S\n]*$/u, "");
}

async function formatJSDocImportType0(
  type: string,
  options: ParserOptions,
): Promise<string> {
  const formatted = await prettier.format(`import ${type}`, {
    ...options,
    parser: "typescript",
  });

  return formatted
    .trim()
    .replace(/^;/u, "")
    .replace(/;$/u, "")
    .trim()
    .replace(/^import[^\S\n]*/u, "")
    .replace(/[^\S\n]*;$/u, "");
}

function getFirstIndent(text: string): string {
  return /^[^\S\n\r]+/u.exec(text)?.[0] || "";
}

function getIndentFromOption(options: ParserOptions): string {
  const { tabWidth, useTabs } = options;
  if (useTabs) {
    return "\t";
  }
  return " ".repeat(tabWidth ?? 2);
}

function transformJSDocFunctionTypeProcessor(): Processor {
  type ParenStack =
    | {
        level: 0;
        paren: null;
        upper: null;
      }
    | {
        level: number;
        paren: PunctuatorToken;
        upper: ParenStack;
      };
  type TokenAndParenScope = {
    token: Token;
    parenStack: ParenStack;
  };
  const parenPairs: Record<string, string> = {
    "(": ")",
    "{": "}",
    "[": "]",
    "<": ">",
  };

  function linesToTokenAndParenScopes(lines: TextLines): TokenAndParenScope[] {
    const scopes: TokenAndParenScope[] = [];
    let parenStack: ParenStack = {
      level: 0,
      paren: null,
      upper: null,
    };
    for (const token of new Tokenizer(lines)) {
      if (token.type === "Punctuator") {
        if (
          token.value === "(" ||
          token.value === "{" ||
          token.value === "[" ||
          token.value === "<"
        ) {
          parenStack = {
            level: parenStack ? parenStack.level + 1 : 1,
            paren: token,
            upper: parenStack,
          };
        } else if (
          parenStack.paren &&
          parenPairs[parenStack.paren.value] === token.value
        ) {
          parenStack = parenStack.upper;
        }
      }
      scopes.push({
        token,
        parenStack,
      });
    }
    return scopes;
  }

  const restoreInfo: { firstParamId: string }[] = [];

  return {
    preprocess: (typeToParse) => {
      const processed = transformJSDocFunctionType(typeToParse);
      return processed;
    },
    postprocess: (formatted) => {
      if (!restoreInfo.length) return formatted;
      const processed = restoreJSDocFunctionType(formatted);
      return processed;
    },
  };

  function transformJSDocFunctionType(type: string): string {
    const lines = new TextLines(type);

    const usedIds = new Set<string>();

    function* iterateUniqueId(): Iterable<string> {
      for (const id of iterateId()) {
        if (!usedIds.has(id)) {
          usedIds.add(id);
          yield `$${id}$`;
        }
      }

      function* iterateId(): Iterable<string> {
        for (const c of "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ") {
          yield c;
        }
        for (const c1 of iterateId()) {
          for (const c2 of "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ") {
            yield `${c1}${c2}`;
          }
        }
      }
    }

    function getUniqueId(): string {
      for (const idCandidate of iterateUniqueId()) {
        if (!type.includes(idCandidate)) {
          return idCandidate;
        }
      }
      throw new Error("No more unique IDs available");
    }

    const functionTypeTransforms = parseType(linesToTokenAndParenScopes(lines));

    if (functionTypeTransforms.length === 0) return type;

    return applyTransform(lines, functionTypeTransforms);

    function parseType(
      tokens: TokenAndParenScope[],
    ): { loc: Location; text: string }[] {
      const transforms: { loc: Location; text: string }[] = [];
      for (const [index, { token, parenStack }] of tokens.entries()) {
        if (parenStack.paren?.value === "{") {
          // Maybe a type literal
          continue;
        }
        if (
          token.value !== "function" ||
          tokens[index + 1]?.token.value !== "("
        )
          continue;

        const paramTransforms = parseParamTypes(tokens.slice(index + 1));
        if (!paramTransforms) continue;
        transforms.push({
          loc: token.loc,
          text: "",
        });
        transforms.push(...paramTransforms);
      }
      return transforms;
    }

    function parseParamTypes(
      tokens: TokenAndParenScope[],
    ): { loc: Location; text: string }[] | null {
      const transforms: { loc: Location; text: string }[] = [];
      const parenLevel = tokens[0].parenStack.level;
      for (const [index, { token, parenStack }] of tokens.entries()) {
        const parenNestLevel = parenStack.level - parenLevel;
        if (parenNestLevel === 0) {
          if (token.value === ":") {
            // Maybe a type annotation
            return null;
          }
          if (token.value === "(") {
            const uniqueId = getUniqueId();
            transforms.push({
              loc: token.loc,
              text: `${token.value}${uniqueId}:`,
            });
            restoreInfo.push({ firstParamId: uniqueId });
          } else if (
            token.value === "," &&
            tokens[index + 1]?.token.value !== ")"
          ) {
            // Param start
            transforms.push({
              loc: token.loc,
              text: `${token.value}{}:`,
            });
          }
        } else if (parenNestLevel === -1) {
          if (token.value !== ")" || tokens[index + 1]?.token.value !== ":")
            continue;
          transforms.push({
            loc: tokens[index + 1].token.loc,
            text: " => ",
          });
          return transforms;
        }
      }
      return null;
    }
  }

  function restoreJSDocFunctionType(formatted: string): string | null {
    const lines = new TextLines(formatted);

    const functionTypeTransforms = parseType(linesToTokenAndParenScopes(lines));

    if (functionTypeTransforms == null) return null;

    return applyTransform(lines, functionTypeTransforms);

    function parseType(
      tokens: TokenAndParenScope[],
    ): { loc: Location; text: string }[] | null {
      const transforms: { loc: Location; text: string }[] = [];
      for (const [index, { token }] of tokens.entries()) {
        if (token.value !== "(") continue;
        const next = tokens[index + 1]?.token;
        if (!next) continue;
        if (!restoreInfo.some((info) => info.firstParamId === next.value))
          continue;
        const paramTransforms = parseParamTypes(
          tokens.slice(index),
          next.value,
        );
        if (!paramTransforms) return null;
        transforms.push({
          loc: token.loc,
          text: `function${token.value}`,
        });
        transforms.push(...paramTransforms);
      }
      return transforms;
    }

    function parseParamTypes(
      tokens: TokenAndParenScope[],
      firstParamId: string,
    ): { loc: Location; text: string }[] | null {
      const transforms: { loc: Location; text: string }[] = [];
      const parenLevel = tokens[0].parenStack.level;
      for (const [index, { token, parenStack }] of tokens.entries()) {
        const parenNestLevel = parenStack.level - parenLevel;
        if (parenNestLevel === 0) {
          if (token.value === "(") {
            const next1 = tokens[index + 1]?.token;
            const next2 = tokens[index + 2]?.token;
            const next3 = tokens[index + 3]?.token;
            if (next1?.value !== firstParamId || next2?.value !== ":" || !next3)
              return null;

            transforms.push({
              loc: {
                start: next1.loc.start,
                end: next3.loc.start,
              },
              text: "",
            });
          } else if (token.value === ",") {
            const next1 = tokens[index + 1]?.token;
            const next2 = tokens[index + 2]?.token;
            const next3 = tokens[index + 3]?.token;
            const next4 = tokens[index + 4]?.token;
            if (next1?.value === ")") continue;
            if (
              next1?.value !== "{" ||
              next2?.value !== "}" ||
              next3?.value !== ":" ||
              !next4
            )
              return null;

            transforms.push({
              loc: {
                start: next1.loc.start,
                end: next4.loc.start,
              },
              text: "",
            });
          }
        } else if (parenNestLevel === -1) {
          if (token.value !== ")") continue;
          const next = tokens[index + 1]?.token;
          if (next?.value !== "=>") continue;
          transforms.push({
            loc: {
              start: token.loc.end,
              end: next.loc.end,
            },
            text: ":",
          });
          return transforms;
        }
      }
      return null;
    }
  }

  function applyTransform(
    lines: TextLines,
    transforms: { loc: Location; text: string }[],
  ): string {
    transforms.sort((a, b) => {
      if (a.loc.start.line !== b.loc.start.line) {
        return a.loc.start.line - b.loc.start.line;
      }
      return a.loc.start.column - b.loc.start.column;
    });

    const transformed: string[] = Array.from({ length: lines.size }, () => "");

    let startLine = 1;
    let startColumn = 0;
    for (const transform of transforms) {
      for (; startLine < transform.loc.start.line; startLine++) {
        const lineText = lines.getLine(startLine);
        if (lineText) transformed[startLine - 1] += lineText.slice(startColumn);
        startColumn = 0;
      }
      const lineText = lines.getLine(startLine);
      if (lineText) {
        transformed[startLine - 1] += lineText.slice(
          startColumn,
          transform.loc.start.column,
        );
      }
      transformed[startLine - 1] += transform.text;
      startLine = transform.loc.end.line;
      startColumn = transform.loc.end.column;
    }
    for (; startLine <= lines.size; startLine++) {
      const lineText = lines.getLine(startLine);
      if (lineText) transformed[startLine - 1] += lineText.slice(startColumn);
      startColumn = 0;
    }

    return transformed.join("\n").trim();
  }
}

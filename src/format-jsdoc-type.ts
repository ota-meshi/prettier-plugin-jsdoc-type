import type { ParserOptions } from "prettier";
import * as prettier from "prettier";

export async function formatJSDocType(
  type: string,
  options: ParserOptions,
): Promise<string | null> {
  const trimmedType = type.trim();
  try {
    if (trimmedType.startsWith("...")) {
      return await formatJSDocTypeAsArrayElementType(trimmedType, options);
    }
    return await formatJSDocTypeAsReturnType(trimmedType, options);
  } catch {
    return null;
  }
}

async function formatJSDocTypeAsReturnType(
  type: string,
  options: ParserOptions,
): Promise<string | null> {
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

async function formatJSDocTypeAsArrayElementType(
  type: string,
  options: ParserOptions,
): Promise<string | null> {
  const formatted = await prettier.format(`type A = [${type}]`, {
    ...options,
    parser: "typescript",
    printWidth: (options.printWidth ?? 80) + 10,
  });

  return formatted
    .trim()
    .replace(/^;/u, "")
    .replace(/;$/u, "")
    .trim()
    .replace(/^type\s+A\s*=\s*\[[^\S\n]*/u, "")
    .replace(/[^\S\n]*\]$/u, "");
}

import type { ParserOptions } from "prettier";
import * as prettier from "prettier";

export async function formatJSDocType(
  type: string,
  options: ParserOptions,
): Promise<string | null> {
  try {
    return await formatJSDocType0(type, options);
  } catch {
    return null;
  }
}

async function formatJSDocType0(
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
    .replace(/^function\s*f\s*\(\s*\)\s*:[^\S\n]*/u, "")
    .replace(/[^\S\n]*\{\s*\}$/u, "");
}

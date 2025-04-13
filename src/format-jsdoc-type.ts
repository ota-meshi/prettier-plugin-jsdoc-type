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
  const formatted = await prettier.format(`(): ${type} => {}`, {
    ...options,
    parser: "typescript",
  });

  return formatted
    .trim()
    .replace(/^;\s*/u, "")
    .replace(/^\(\s*\)\s*:\s*/u, "")
    .replace(/\s*;$/u, "")
    .replace(/\s*=>\s*\{\s*\}$/u, "");
}

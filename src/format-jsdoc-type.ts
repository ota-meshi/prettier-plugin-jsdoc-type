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
    if (trimmedType.length > 1 && trimmedType.endsWith("?")) {
      return await formatJSDocTypeAsTypeAlias(trimmedType, options);
    }
    if (trimmedType.endsWith("=")) {
      const formatted = await formatJSDocTypeAsTypeAlias(
        `(${trimmedType.slice(0, -1)})?`,
        options,
      );
      if (formatted == null) return null;
      // Replace the last `?` with `=`
      const lastOptional = /\?(\s*)$/u.exec(formatted);
      if (!lastOptional) return null;
      return `${formatted.slice(0, lastOptional.index)}=${lastOptional[1]}`;
    }
    return await formatJSDocTypeAsReturnType(trimmedType, options);
  } catch {
    return null;
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

async function formatJSDocTypeAsArrayElementType(
  type: string,
  options: ParserOptions,
): Promise<string> {
  const formatted = await formatJSDocTypeAsTypeAlias(`[${type}]`, options);

  return formatted
    ?.trim()
    .replace(/^\[[^\S\n]*/u, "")
    .replace(/[^\S\n]*\]$/u, "");
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

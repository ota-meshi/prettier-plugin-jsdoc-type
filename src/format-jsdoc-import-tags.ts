import { getJSDocIndentFromText } from "./jsdoc-indent-from-text.js";
import type { ParserOptions } from "prettier";
import * as prettier from "prettier";
import type * as TS from "typescript";

type Fix = {
  text: string;
  range: [number, number];
};

export async function formatJSDocImportTags(
  text: string,
  options: ParserOptions,
): Promise<string | null> {
  try {
    const formatted = await formatJSDocImportTags0(`/*${text}*/`, options);

    return formatted
      ? formatted.replace(/^\/\*/u, "").replace(/\*\/$/u, "")
      : formatted;
  } catch {
    return null;
  }
}

let cache: { ts: typeof TS | null } | null = null;

export async function getTypescript(): Promise<typeof TS | null> {
  if (cache) {
    return cache.ts;
  }
  try {
    const ts = await import("typescript");
    const version = ts.version.split(".").map(Number);
    if (version[0] < 5 || (version[0] === 5 && version[1] < 5)) {
      // typescript version is too old
      // eslint-disable-next-line require-atomic-updates -- OK
      cache = { ts: null };
      return null;
    }
    // eslint-disable-next-line require-atomic-updates -- OK
    cache = { ts };
    return ts;
  } catch {
    cache = { ts: null };
    return null;
  }
}

async function formatJSDocImportTags0(
  text: string,
  options: ParserOptions,
): Promise<string | null> {
  const ts = await getTypescript();
  if (!ts) return null;
  const compilerHost: TS.CompilerHost = {
    fileExists: () => true,
    getCanonicalFileName: (filename) => filename,
    getCurrentDirectory: () => "",
    getDefaultLibFileName: () => "lib.d.ts",
    getNewLine: () => "\n",
    getSourceFile: (filename) => {
      return ts.createSourceFile(filename, text, ts.ScriptTarget.Latest);
    },
    readFile: () => undefined,
    useCaseSensitiveFileNames: () => true,
    writeFile: () => null,
  };
  const program = ts.createProgram(
    ["file.js"],
    {
      noResolve: true,
      target: ts.ScriptTarget.Latest,
      // jsDocParsingMode: ts.JSDocParsingMode.ParseAll,
      checkJs: true,
    },
    compilerHost,
  );
  const sourceFile = program.getSourceFile("file.js")!;

  const fixList: Fix[] = [];
  await traverse(sourceFile, async (node) => {
    if (ts.isJSDocImportTag(node)) {
      const tag = node;

      const formatted = await formatJSDocImportTag(
        ts,
        tag,
        sourceFile,
        options,
      );
      if (formatted) fixList.push(formatted);
    }
  });

  fixList.sort((a, b) => a.range[0] - b.range[0]);

  let fixed = "";

  let start = 0;
  for (const fix of fixList) {
    fixed += text.slice(start, fix.range[0]);
    fixed += fix.text;
    start = fix.range[1];
  }
  fixed += text.slice(start);
  return fixed;
}

async function formatJSDocImportTag(
  ts: typeof TS,
  tag: TS.JSDocImportTag,
  sourceFile: TS.SourceFile,
  options: ParserOptions,
): Promise<Fix | null> {
  try {
    return await formatJSDocImportTag0(ts, tag, sourceFile, options);
  } catch {
    return null;
  }
}

async function formatJSDocImportTag0(
  ts: typeof TS,
  tag: TS.JSDocImportTag,
  sourceFile: TS.SourceFile,
  options: ParserOptions,
): Promise<Fix | null> {
  const formatted = await prettier.format(
    getTextJSDocImportTag(ts, tag, sourceFile),
    {
      ...options,
      parser: "typescript",
    },
  );

  const formattedImportTag = formatted.trim().replace(/[^\S\n]*;$/u, "");
  if (!formattedImportTag.includes("\n")) {
    return {
      text: `@${formattedImportTag}`,
      range: [tag.pos, (tag.attributes || tag.moduleSpecifier).end],
    };
  }
  let indent = getJSDocIndentFromText(sourceFile.text);
  const lfIndex = sourceFile.text.lastIndexOf("\n", tag.pos);
  if (lfIndex > -1) {
    const lineText = sourceFile.text.slice(lfIndex + 1);
    const indentCandidate = /^\s*(?:\*\s*)?/u.exec(lineText)?.[0];
    if (indentCandidate) {
      indent = indentCandidate;
    }
  }
  const formattedLines = formattedImportTag.split("\n");
  const formattedImportTagWithIndent = formattedLines
    .map((line, i) => (i ? `${indent}${line}` : line))
    .join("\n");
  return {
    text: `@${formattedImportTagWithIndent}`,
    range: [tag.pos, (tag.attributes || tag.moduleSpecifier).end],
  };
}

function getTextJSDocImportTag(
  ts: typeof TS,
  tag: TS.JSDocImportTag,
  sourceFile: TS.SourceFile,
): string {
  const importClause: string[] = [];
  if (tag.importClause) {
    if (tag.importClause.name) {
      importClause.push(tag.importClause.name.getText(sourceFile));
    }
    if (tag.importClause.namedBindings) {
      if (ts.isNamedImports(tag.importClause.namedBindings)) {
        const namedImports = tag.importClause.namedBindings;
        const specs: string[] = [];
        for (const element of namedImports.elements) {
          const specText: string[] = [];
          if (element.isTypeOnly) {
            specText.push("type");
          }
          specText.push(element.name.getText(sourceFile));
          if (element.propertyName) {
            specText.push("as");
            specText.push(element.propertyName.getText(sourceFile));
          }
          specs.push(specText.join(" "));
        }
        importClause.push(`{${specs.join(", ")}}`);
      } else if (ts.isNamespaceImport(tag.importClause.namedBindings)) {
        const namespaceImport = tag.importClause.namedBindings;
        importClause.push(`* as ${namespaceImport.name.getText(sourceFile)}`);
      }
    }
  }

  const moduleSpecifier = tag.moduleSpecifier.getText(sourceFile);

  if (!tag.attributes) {
    return `import ${importClause.join(",")} from ${moduleSpecifier}`;
  }

  const attributes: string[] = [];
  for (const element of tag.attributes.elements) {
    attributes.push(
      `${element.name.getText(sourceFile)}:${element.value.getText(sourceFile)}`,
    );
  }

  return `import ${importClause.join(",")} from ${moduleSpecifier} with {${attributes.join(",")}}`;
}

async function traverse(
  sourceFile: TS.SourceFile,
  callback: (node: TS.Node) => Promise<void>,
): Promise<void> {
  const promises: Promise<void>[] = [];
  const buffer: TS.Node[] = [sourceFile];
  let n: TS.Node | undefined;
  while ((n = buffer.shift())) {
    promises.push(callback(n));
    buffer.unshift(...n.getChildren(sourceFile));
  }

  await Promise.all(promises);
}

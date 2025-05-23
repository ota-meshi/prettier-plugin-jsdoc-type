import { parseComment } from "./comment/parser.js";
import {
  formatJSDocImportTags,
  getTypescript,
} from "./format-jsdoc-import-tags.js";
import { formatJSDocImportType, formatJSDocType } from "./format-jsdoc-type.js";
import type { Comment } from "./js/comment.js";
import { getJSDocIndentFromText } from "./jsdoc-indent-from-text.js";
import type * as commentParser from "comment-parser";
import type { ParserOptions } from "prettier";

export let forceUseTypescript: boolean | null = null;
export function setForceUseTypescript(value: boolean | null): void {
  forceUseTypescript = value;
}

export async function formatJSDoc(
  comment: Comment,
  options: ParserOptions,
): Promise<string | null> {
  let availableTs: boolean | null = forceUseTypescript;

  const block = parseComment(comment.value);
  const lineSources = block.source.map((line) => line.source);

  const lines: (
    | {
        type: "text";
        text: string;
      }
    | {
        type: "tag";
        text: string;
        tag: commentParser.Spec;
      }
  )[] = [];
  let startLine = 0;
  for (const tag of block.tags) {
    if (!tag.type) continue;
    if (
      tag.tag === "import" &&
      (availableTs ??= Boolean(await getTypescript()))
    )
      continue;
    const tagStartLine = tag.source[0].number;
    const tagEndLine = tag.source[tag.source.length - 1].number + 1;
    lines.push(
      ...lineSources.slice(startLine, tagStartLine).map((source) => ({
        type: "text" as const,
        text: source,
      })),
    );
    lines.push({
      type: "tag",
      tag,
      text: lineSources.slice(tagStartLine, tagEndLine).join("\n"),
    });
    startLine = tagEndLine;
  }
  lines.push(
    ...lineSources.slice(startLine).map((source) => ({
      type: "text" as const,
      text: source,
    })),
  );

  const textLines = await Promise.all(
    lines.map(async (line) => {
      if (line.type !== "tag") return line.text;
      const tag = line.tag;
      const formattedTag = await formatJSDocTag(tag, options);
      if (formattedTag == null) return line.text;
      return formattedTag;
    }),
  );

  const formatted = textLines
    .join("\n")
    .replace(/^\/\*/u, "")
    .replace(/\*\/$/u, "");

  if (
    block.tags.some((tag) => tag.tag === "import") &&
    (availableTs ??= Boolean(await getTypescript()))
  ) {
    return formatJSDocImportTags(formatted, options);
  }
  return formatted;
}

function tokensToIndent(tokens: commentParser.Tokens) {
  return tokens.start + tokens.delimiter + tokens.postDelimiter;
}

async function formatJSDocTag(
  tag: commentParser.Spec,
  options: ParserOptions,
): Promise<string | null> {
  if (!tag.type) return null;

  const typeStartLine = tag.source.find((line) => line.tokens.type)!;
  const typeEndLine = tag.source.findLast((line) => line.tokens.type)!;

  const prefix: string[] = [];
  const suffix: string[] = [];

  for (const sourceLine of tag.source) {
    if (sourceLine.number < typeStartLine.number) {
      prefix.push(sourceLine.source);
      continue;
    }
    if (sourceLine.number === typeStartLine.number) {
      prefix.push(
        sourceLine.tokens.start +
          sourceLine.tokens.delimiter +
          sourceLine.tokens.postDelimiter +
          sourceLine.tokens.tag +
          sourceLine.tokens.postTag,
      );
    }
    if (sourceLine.number === typeEndLine.number) {
      suffix.push(
        sourceLine.tokens.postType +
          sourceLine.tokens.name +
          sourceLine.tokens.postName +
          sourceLine.tokens.description +
          sourceLine.tokens.end,
      );
    }
    if (typeEndLine.number < sourceLine.number) {
      suffix.push(sourceLine.source);
      continue;
    }
  }

  let formattedType: string | null = null;
  if (tag.tag !== "import") {
    formattedType = await formatJSDocType(tag.type, options);
    prefix[prefix.length - 1] += "{";
    suffix[0] = `}${suffix[0]}`;
  } else {
    formattedType = await formatJSDocImportType(tag.type, options);
    prefix[prefix.length - 1] = `${prefix[prefix.length - 1].trimEnd()} `;
  }
  if (formattedType == null) return null;

  if (!formattedType.includes("\n")) {
    return `${prefix.join("\n")}${formattedType}${suffix.join("\n")}`;
  }
  const formattedTypeLines = formattedType.split("\n");
  const indent =
    typeStartLine.number === 0
      ? getJSDocIndentFromText(tag.source.map((line) => line.source).join("\n"))
      : tokensToIndent(typeStartLine.tokens);
  const formattedTypeWithIndent = formattedTypeLines
    .map((line, i) => (i ? `${indent}${line}` : line))
    .join("\n");
  return `${prefix.join("\n")}${formattedTypeWithIndent}${suffix.join("\n")}`;
}

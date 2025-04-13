import { formatJSDoc } from "./format-jsdoc.js";
import type { Comment } from "./js/comment.js";
import isBlockComment from "./js/is-block-comment.js";
import * as meta from "./meta.js";
import type { WrappedContext } from "./wrapped-parser.js";
import { createWrappedParser } from "./wrapped-parser.js";
import type { Parser, ParserOptions } from "prettier";
import * as babelPlugin from "prettier/plugins/babel";
import * as flowPlugin from "prettier/plugins/flow";
import * as typescriptPlugin from "prettier/plugins/typescript";

export { meta };

async function wrappedParse(
  context: WrappedContext<unknown>,
  text: string,
  options: ParserOptions<unknown>,
): Promise<unknown> {
  const ast = await context.rawParser.parse(text, options);
  await processComments(ast, context.rawOptions);
  return ast;
}

async function processComments(
  ast: unknown,
  options: ParserOptions<unknown>,
): Promise<void> {
  await Promise.all(
    (ast as { comments: Comment[] }).comments.map(async (comment) => {
      if (!isBlockComment(comment) || !comment.value.startsWith("*")) {
        return;
      }
      const formatted = await formatJSDoc(comment, options);
      if (formatted) {
        // eslint-disable-next-line require-atomic-updates -- OK
        comment.value = formatted;
      }
    }),
  );
}

export const parsers: Record<string, Parser> = {
  babel: createWrappedParser(
    "babel",
    {
      parse: wrappedParse,
    },
    babelPlugin.parsers.babel,
  ),
  flow: createWrappedParser(
    "flow",
    {
      parse: wrappedParse,
    },
    flowPlugin.parsers.flow,
  ),
  typescript: createWrappedParser(
    "typescript",
    {
      parse: wrappedParse,
    },
    typescriptPlugin.parsers.typescript,
  ),
};

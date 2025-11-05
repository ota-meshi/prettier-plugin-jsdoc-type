import { tokenizeImportType } from "./tokenize-import-type.js";
import { tokenizeTypeExpression } from "./tokenize-type-expression.js";
import * as commentParser from "comment-parser";

type Tokenizer = (spec: commentParser.Spec) => commentParser.Spec;

export function parseComment(text: string): commentParser.Block {
  const block = commentParser.parse(`/*${text}*/`, {
    tokenizers: getTokenizers(),
  })[0];
  return block;
}

function getTokenizers(): Tokenizer[] {
  return [
    commentParser.tokenizers.tag(),
    /** Type tokenizer. */
    (spec) => {
      if (spec.tag === "import") {
        return tokenizeImportType(spec);
      }

      return tokenizeTypeExpression(spec);
    },
    commentParser.tokenizers.name(),
    commentParser.tokenizers.description("preserve"),
  ];
}

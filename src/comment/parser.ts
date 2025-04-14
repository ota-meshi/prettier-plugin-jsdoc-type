import { tokenizeImportType } from "./tokenize-import-type.js";
import * as commentParser from "comment-parser";

type Tokenizer = (spec: commentParser.Spec) => commentParser.Spec;

export function parseComment(text: string): commentParser.Block {
  const block = commentParser.parse(`/*${text}*/`, {
    tokenizers: getTokenizers(),
  })[0];
  return block;
}

function getTokenizers(): Tokenizer[] {
  const typeTokenizer = commentParser.tokenizers.type("preserve");

  return [
    commentParser.tokenizers.tag(),
    /** Type tokenizer. */
    (spec) => {
      if (spec.tag === "import") {
        return tokenizeImportType(spec);
      }

      return typeTokenizer(spec);
    },
    commentParser.tokenizers.name(),
    commentParser.tokenizers.description("preserve"),
  ];
}

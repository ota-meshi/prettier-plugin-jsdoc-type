import { parseComment } from "../../../src/comment/parser.js";
import { listupFixtures } from "../../utils/utils.js";
import assert from "assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Test for parse comment", () => {
  for (const { input, inputFileName, outputFileName } of listupFixtures(
    path.resolve(dirname, "../../fixtures/parse-comment"),
    {
      outputExt: ".json",
    },
  )) {
    // if (!inputFileName.includes("$test$")) continue;

    describe(inputFileName, () => {
      it("should be the formatted result expect.", () => {
        const commentValue = input
          .trim()
          .replace(/^\/\*/u, "")
          .replace(/\*\/$/u, "");
        const block = parseComment(commentValue);
        const blockJson = JSON.stringify(block, null, 2);
        if (
          !fs.existsSync(outputFileName) ||
          process.argv.includes("--update")
        ) {
          fs.writeFileSync(outputFileName, blockJson, "utf8");
        }
        const output = JSON.parse(fs.readFileSync(outputFileName, "utf8"));
        assert.deepStrictEqual(block, output);
      });
    });
  }
});

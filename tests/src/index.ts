import * as plugin from "../../src/index.js";
import { listupFixtures } from "../utils/utils.js";
import assert from "assert";
import fs from "fs";
import path from "path";
import * as prettier from "prettier";
import { fileURLToPath } from "url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Test for format", () => {
  for (const { input, inputFileName, outputFileName, config } of listupFixtures(
    path.resolve(dirname, "../fixtures/format"),
  )) {
    describe(inputFileName, () => {
      it("should be the formatted result wr expect.", async () => {
        const code = await prettier.format(input, {
          ...config,
          filepath: inputFileName,
          plugins: [
            "@trivago/prettier-plugin-sort-imports",
            ...(config?.plugins ?? []),
            plugin,
          ],
        });
        if (
          !fs.existsSync(outputFileName) ||
          process.argv.includes("--update")
        ) {
          fs.writeFileSync(outputFileName, code, "utf8");
        }
        const output = fs.readFileSync(outputFileName, "utf8");
        assert.strictEqual(code, output);
      });
    });
  }
});

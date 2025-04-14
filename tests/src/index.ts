import { setForceUseTypescript } from "../../src/format-jsdoc.js";
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
    // if (!inputFileName.includes("test")) continue;
    for (const forceUsedTypescript of [false, null]) {
      describe(
        forceUsedTypescript ? "with typescript" : "without typescript",
        () => {
          describe(inputFileName, () => {
            it("should be the formatted result expect.", async () => {
              setForceUseTypescript(forceUsedTypescript);
              const code = await prettier.format(input, {
                ...config,
                filepath: inputFileName,
                plugins: [...(config?.plugins ?? []), plugin],
              });
              if (
                !fs.existsSync(outputFileName) ||
                process.argv.includes("--update")
              ) {
                fs.writeFileSync(outputFileName, code, "utf8");
              }
              const output = fs.readFileSync(outputFileName, "utf8");
              assert.strictEqual(code, output);

              const codeWithoutPlugin = await prettier.format(input, {
                ...config,
                filepath: inputFileName,
                plugins: [...(config?.plugins ?? [])],
              });

              const textOption = config.testOption as
                | undefined
                | Record<string, unknown>;
              if (textOption?.sameOutputAsWithoutPlugin) {
                assert.strictEqual(code, codeWithoutPlugin);
              } else {
                assert.notStrictEqual(
                  code,
                  codeWithoutPlugin,
                  "Test cases have the same format without the plugin.",
                );
              }
            });
          });
        },
      );
    }
  }
});

import { setForceUseTypescript } from "../../src/format-jsdoc.js";
import * as plugin from "../../src/index.js";
import { listupFixtures } from "../utils/utils.js";
import assert from "assert";
import fs from "fs";
import path from "path";
import * as prettier from "prettier";
import { fileURLToPath } from "url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

type TestOption = {
  sameOutputAsWithoutPlugin?: true;
  ignoreTypescript?: true;
  ignoreWithoutTypescript?: true;
};

describe("Test for format", () => {
  for (const { input, inputFileName, outputFileName, config } of listupFixtures(
    path.resolve(dirname, "../fixtures/format"),
  )) {
    // if (!inputFileName.includes("$test$")) continue;

    const textOption = config.testOption as undefined | TestOption;
    for (const forceUsedTypescript of [false, null]) {
      if (forceUsedTypescript == null && textOption?.ignoreTypescript) continue;
      if (forceUsedTypescript === false && textOption?.ignoreWithoutTypescript)
        continue;
      describe(
        forceUsedTypescript == null || forceUsedTypescript
          ? "with typescript"
          : "without typescript",
        () => {
          describe(inputFileName, () => {
            it("should be the formatted result expect.", async () => {
              setForceUseTypescript(forceUsedTypescript);
              const formatted = await prettier.format(input, {
                ...config,
                filepath: inputFileName,
                plugins: [...(config?.plugins ?? []), plugin],
              });
              if (
                !fs.existsSync(outputFileName) ||
                (process.argv.includes("--update") &&
                  forceUsedTypescript === false)
              ) {
                fs.writeFileSync(outputFileName, formatted, "utf8");
              }
              const output = fs.readFileSync(outputFileName, "utf8");
              assert.strictEqual(formatted, output);

              const formattedWithoutPlugin = await prettier.format(input, {
                ...config,
                filepath: inputFileName,
                plugins: [...(config?.plugins ?? [])],
              });

              if (textOption?.sameOutputAsWithoutPlugin) {
                assert.strictEqual(formatted, formattedWithoutPlugin);
              } else {
                assert.notStrictEqual(
                  formatted,
                  formattedWithoutPlugin,
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

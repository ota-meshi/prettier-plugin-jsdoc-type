import fs from "fs";
import path from "path";
import type { ParserOptions } from "prettier";

export function* listupFixtures(
  dir: string,
  options?: { outputExt: string },
): IterableIterator<{
  input: string;
  inputFileName: string;
  outputFileName: string;
  config: Partial<ParserOptions>;
}> {
  for (const dirent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!dirent.isFile()) continue;
    const inputFileName = path.join(dirent.parentPath, dirent.name);
    const ext = path.extname(dirent.name);
    const baseName = path.basename(dirent.name, ext);
    if (!baseName.endsWith("input")) continue;
    const outputFileName = path.join(
      dirent.parentPath,
      baseName.replace(/input$/u, "output") + (options?.outputExt ?? ext),
    );
    const configFileName = path.join(
      dirent.parentPath,
      baseName.replace(/input$/u, "config.json"),
    );
    const input = fs.readFileSync(inputFileName, "utf8");

    yield {
      input,
      inputFileName,
      outputFileName,
      config: fs.existsSync(configFileName)
        ? JSON.parse(fs.readFileSync(configFileName, "utf8"))
        : {},
    };
  }
}

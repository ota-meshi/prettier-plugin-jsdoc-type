import fs from "fs";
import path from "path";

export function* listupFixtures(dir: string): IterableIterator<{
  input: string;
  inputFileName: string;
  outputFileName: string;
}> {
  yield* listupFixturesImpl(dir);
}

function* listupFixturesImpl(dir: string): IterableIterator<{
  input: string;
  inputFileName: string;
  outputFileName: string;
}> {
  for (const dirent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!dirent.isFile()) continue;
    const inputFileName = path.join(dirent.parentPath, dirent.name);
    const ext = path.extname(dirent.name);
    const baseName = path.basename(dirent.name, ext);
    if (!baseName.endsWith("input")) continue;
    const outputFileName = path.join(
      dirent.parentPath,
      baseName.replace(/input$/u, "output") + ext,
    );
    const input = fs.readFileSync(inputFileName, "utf8");

    yield {
      input,
      inputFileName,
      outputFileName,
    };
  }
}

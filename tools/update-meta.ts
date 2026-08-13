import pkg from "../package.json" with { type: "json" };
import { getNewVersion } from "./lib/changesets-util.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const { name, version } = pkg;

const dirname = path.dirname(fileURLToPath(import.meta.url));
const META_PATH = path.join(dirname, "../src/meta.ts");

void main();

/** main */
async function main() {
  fs.writeFileSync(
    META_PATH,
    `/*
 * IMPORTANT!
 * This file has been automatically generated,
 * in order to update its content execute "npm run update"
 */
export const name = ${JSON.stringify(name)} as const;
export const version = ${JSON.stringify(await getVersion())} as const;
`,
    "utf8",
  );
}

/** Get version */
function getVersion() {
  // eslint-disable-next-line no-process-env -- ignore
  if (process.env.IN_VERSION_CI_SCRIPT) {
    return getNewVersion();
  }
  return version;
}

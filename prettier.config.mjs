import fs from "fs";
import { fileURLToPath } from "url";

let pluginPath = "";
try {
  // eslint-disable-next-line n/no-unsupported-features/node-builtins -- ok
  pluginPath = fileURLToPath(import.meta.resolve("./lib/index.js"));
} catch {
  // ignore
}

export default {
  plugins: [
    "@trivago/prettier-plugin-sort-imports",
    ...(pluginPath && fs.existsSync(pluginPath) ? [pluginPath] : []),
  ],
};

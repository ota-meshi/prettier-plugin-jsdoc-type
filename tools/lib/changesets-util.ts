import getReleasePlan from "@changesets/get-release-plan";
import path from "path";
import { fileURLToPath } from "url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

/** Get new version string from changesets */
export async function getNewVersion(): Promise<string> {
  const releasePlan = await getReleasePlan(path.resolve(dirname, "../.."));
  const newVersion = releasePlan.releases.find(
    ({ name }) => name === "prettier-plugin-jsdoc-type",
  )?.newVersion;

  if (newVersion === undefined) {
    throw new Error(
      "Could not determine the new version for prettier-plugin-jsdoc-type.",
    );
  }

  return newVersion;
}

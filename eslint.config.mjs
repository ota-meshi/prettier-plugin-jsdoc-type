import myPlugin from "@ota-meshi/eslint-plugin";

export default [
  ...myPlugin.config({
    node: true,
    ts: true,
    eslintPlugin: true,
    packageJson: true,
    json: true,
    yaml: true,
    md: true,
    prettier: true,
    vue3: true,
  }),
  {
    rules: {
      complexity: "off",
      "func-style": "off",
      "jsdoc/require-jsdoc": "off",
    },
  },
  {
    files: ["**/*.ts", "**/*.mts"],
    rules: {
      "@typescript-eslint/switch-exhaustiveness-check": [
        "error",
        {
          allowDefaultCaseForExhaustiveSwitch: false,
          considerDefaultExhaustiveForUnions: true,
          requireDefaultForNonUnion: true,
        },
      ],
      "default-case": "off",
    },
  },
  {
    files: ["**/*.md", "*.md"].flatMap((pattern) => [
      `${pattern}/*.js`,
      `${pattern}/*.mjs`,
    ]),
    rules: {
      "n/no-missing-import": "off",
    },
  },
  {
    ignores: [
      ".nyc_output/",
      "coverage/",
      "node_modules/",
      "lib/",
      "!.github/",
      "!.vscode/",
      "!.devcontainer/",
      "tests/fixtures/**/*.*",
    ],
  },
];

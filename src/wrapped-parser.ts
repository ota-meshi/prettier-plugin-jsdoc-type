import type { Parser, ParserOptions, Plugin } from "prettier";

export type WrappedParserPlugin<T> = {
  parse?: (
    baseParser: Parser<T>,
    text: string,
    options: ParserOptions<T>,
  ) => T | Promise<T>;
  preprocess?: (
    baseParser: Parser<T>,
    text: string,
    options: ParserOptions<T>,
  ) => string;
};
/**
 * Create a wrapped parser.
 */
export function createWrappedParser<T = unknown>(
  parserName: string,
  plugin: WrappedParserPlugin<T>,
  baseParser: Parser<T>,
): Parser<T> {
  let baseParserPromise: Promise<Parser<T>> = Promise.resolve(baseParser);
  const wrappedParser: Parser<T> = {
    astFormat: baseParser.astFormat,
    preprocess(text: string, options: ParserOptions<T>): string {
      let pluginParser = getParserPluginByParserName(
        options.plugins as Plugin<T>[],
        parserName,
        wrappedParser,
      );
      if (typeof pluginParser === "function") {
        pluginParser = pluginParser();
      }
      baseParserPromise = Promise.resolve(pluginParser).then((parser) => {
        for (const key of Object.keys(wrappedParser) as (keyof Parser)[]) {
          if (key === "preprocess" || key === "parse" || key === "astFormat") {
            continue;
          }
          delete wrappedParser[key];
        }

        for (const [key, value] of Object.entries(parser) as [
          keyof Parser,
          unknown,
        ][]) {
          if (wrappedParser[key]) {
            continue;
          }
          Object.defineProperty(wrappedParser, key, {
            value:
              typeof value !== "function"
                ? value
                : (...args: unknown[]) => {
                    return value.apply(parser, args);
                  },
            enumerable: true,
            configurable: true,
          });
        }
        return parser;
      });
      return text;
    },
    async parse(text: string, options: ParserOptions<T>, ...args): Promise<T> {
      const parser = await baseParserPromise;
      let processedText = text;
      if (plugin?.preprocess || parser.preprocess) {
        processedText =
          plugin?.preprocess?.(parser, processedText, options) ??
          parser.preprocess!(processedText, options);
        options.originalText = processedText;
      }
      return (
        plugin?.parse?.(parser, processedText, options, ...args) ??
        parser.parse(processedText, options, ...args)
      );
    },
    locStart: baseParser.locStart,
    locEnd: baseParser.locEnd,
  };

  return wrappedParser;
}

function getParserPluginByParserName<T>(
  plugins: Plugin<T>[],
  parserName: string,
  wrappedParser: Parser,
): Parser<T> | Promise<Parser<T>> | (() => Promise<Parser<T>>) {
  const parserPlugin = plugins.findLast(
    (plugin) =>
      plugin.parsers &&
      Object.hasOwn(plugin.parsers, parserName) &&
      plugin.parsers[parserName] !== wrappedParser,
  );
  if (parserPlugin) {
    return parserPlugin.parsers![parserName];
  }

  throw new Error(`Couldn't resolve parser "${parserName}".`);
}

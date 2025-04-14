import type { Parser, ParserOptions, Plugin } from "prettier";

export type WrappedParserPlugin<T> = {
  parse?: (
    context: WrappedContext<T>,
    text: string,
    options: ParserOptions<T>,
  ) => T | Promise<T>;
  preprocess?: (
    context: WrappedContext<T>,
    text: string,
    options: ParserOptions<T>,
  ) => string;
};

export type WrappedContext<T> = {
  rawParser: Parser<T>;
  rawOptions: ParserOptions<T>;
};
/**
 * Create a wrapped parser.
 */
export function createWrappedParser<T = unknown>(
  parserName: string,
  plugin: WrappedParserPlugin<T>,
  baseParser: Parser<T>,
): Parser<T> {
  const cacheWrappedOptions = new WeakMap<ParserOptions<T>, ParserOptions<T>>();

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
      const rawParser = await baseParserPromise;
      const wrappedOptions = wrapOptions(options);
      const context: WrappedContext<T> = {
        rawParser,
        rawOptions: options,
      };
      let processedText = text;
      if (plugin?.preprocess || rawParser.preprocess) {
        processedText =
          plugin?.preprocess?.(context, processedText, wrappedOptions) ??
          rawParser.preprocess!(processedText, wrappedOptions);
        options.originalText = processedText;
      }
      return (
        plugin?.parse?.(context, processedText, wrappedOptions, ...args) ??
        rawParser.parse(processedText, wrappedOptions, ...args)
      );
    },
    locStart: baseParser.locStart,
    locEnd: baseParser.locEnd,
  };

  return wrappedParser;

  function wrapOptions(options: ParserOptions<T>): ParserOptions<T> {
    if (cacheWrappedOptions.has(options)) {
      return cacheWrappedOptions.get(options)!;
    }
    const result = new Proxy(options, {
      get(_target, prop) {
        if (prop === "plugins") {
          if (Array.isArray(options.plugins)) {
            const plugins = options.plugins as Plugin<T>[];
            return plugins.filter(
              (p) =>
                !p.parsers || !Object.values(p.parsers).includes(wrappedParser),
            );
          }
        }
        return options[prop as keyof ParserOptions<T>];
      },
      set(_target, prop, value) {
        options[prop as keyof ParserOptions<T>] = value;
        return true;
      },
    });
    cacheWrappedOptions.set(options, result);
    return result;
  }
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

/** @import { Foo } from "bar" */
/**
 * @param {string} a Foo
 * @param {{ i: 42 }} b Bar
 * @param {{
 *   a: number;
 *   b: string;
 * }} c
 * @returns {c is { a: number; b: string; c: string; d: string; e: string; f: string }}
 */
function foo(a, b) {}

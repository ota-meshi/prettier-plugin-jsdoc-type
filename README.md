# prettier-plugin-jsdoc-type

Prettier plugin for formatting JSDoc type annotations.

> This plugin is in the **_experimental stages_** of development.

## Features

- Formats JSDoc type annotations to a consistent TypeScript style.
- Supports various JSDoc type syntax that TypeScript can parse, including object types, arrays, and unions.

**Example**:

Input:

<!-- prettier-ignore-start -->

```js
/** @type {{a?:number,b?:string}} */
const obj = {}

/**
 * @param {{
 * type?:string,
 *  a?:number
 *   b?:string}} n
 * @returns {n   is Foo}
 */
function fn (n) {
  // do something
}

/** @import {Foo}from'bar'  */
```

<!-- prettier-ignore-end -->

Output:

```js
/** @type {{ a?: number; b?: string }} */
const obj = {};

/**
 * @param {{
 *   type?: string;
 *   a?: number;
 *   b?: string;
 * }} n
 * @returns {n is Foo}
 */
function fn(n) {
  // do something
}

/** @import { Foo } from "bar"  */
```

## Installation

```bash
npm install --save-dev prettier-plugin-jsdoc-type
```

## Usage

You can use this plugin with Prettier by adding it to your Prettier configuration file:

```json
{
  "plugins": ["prettier-plugin-jsdoc-type"]
}
```

## What is the difference with prettier-plugin-jsdoc?

This plugin is focused on formatting JSDoc type annotations, while `prettier-plugin-jsdoc` is focused on formatting JSDoc comments.

This plugin supports some more JSDoc type definition syntax than `prettier-plugin-jsdoc`, such as `@import` and `@returns {foo is Foo}`.
This plugin can also be combined with `prettier-plugin-jsdoc`.

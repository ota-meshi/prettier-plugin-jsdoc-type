/* Copied from https://github.com/prettier/prettier/blob/88e35f974fecd06d64fba59d4dc94a6b371a0728/src/language-js/utils/create-type-check-function.js */
import type { Comment } from "./comment.js";

function createTypeCheckFunction(typesArray: string[]) {
  const types = new Set(typesArray);
  return (node: Comment): boolean => types.has(node?.type);
}

export default createTypeCheckFunction;

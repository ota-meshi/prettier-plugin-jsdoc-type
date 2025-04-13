/* Copied from https://github.com/prettier/prettier/blob/88e35f974fecd06d64fba59d4dc94a6b371a0728/src/language-js/utils/is-block-comment.js */
import createTypeCheckFunction from "./create-type-check-function.js";

const isBlockComment = createTypeCheckFunction([
  "Block",
  "CommentBlock",
  // `meriyah`
  "MultiLine",
]);

export default isBlockComment;

export function getJSDocIndentFromText(text: string): string {
  const lines = text.split("\n");
  if (lines.length <= 1) {
    return " * ";
  }
  let indent: string | null = null;
  for (const line of lines.slice(1)) {
    const lineIndent = /^\s*/u.exec(line)![0];
    if (indent == null || indent.length > lineIndent.length) {
      indent = lineIndent;
    }
  }
  return `${indent}* `;
}

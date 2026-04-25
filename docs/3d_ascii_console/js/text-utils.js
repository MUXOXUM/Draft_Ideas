export function insetTextLines(lines, topInset = 0, leftInset = 0) {
  const insetLines = [];
  const leftPadding = " ".repeat(Math.max(0, leftInset));

  for (let i = 0; i < topInset; i += 1) {
    insetLines.push("");
  }

  lines.forEach((line) => {
    insetLines.push(`${leftPadding}${line}`);
  });

  return insetLines;
}

export function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

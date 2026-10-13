const BOILERPLATE = /^(?:_{5,}|Microsoft Teams (?:meeting|Need help)|Join(?: the meeting)?(?: now)?\s*:|Join on your computer|Click here to join|Meeting ID\s*:|Passcode\s*:|For organizers\s*:)/i;
const AGENDA_HEADING = /^\s*agenda\s*:?\s*(.*)$/i;
const LIST_LINE = /^\s*(?:[-*•–·▪]|\d+[.)])\s+\S/;

/**
 * Pulls the agenda out of a calendar invite's plain-text body: drops the Teams join
 * boilerplate, then prefers the text after an "Agenda" heading, then list-like lines,
 * then whatever text is left.
 */
export function extractAgendaFromInvite(bodyText: string): string {
  const lines = bodyText.replace(/\r/g, "").split("\n");
  const cut = lines.findIndex((line) => BOILERPLATE.test(line.trim()));
  const content = (cut === -1 ? lines : lines.slice(0, cut)).map((line) => line.trimEnd());

  const headingAt = content.findIndex((line) => AGENDA_HEADING.test(line));
  if (headingAt !== -1) {
    const inline = (content[headingAt].match(AGENDA_HEADING)?.[1] ?? "").trim();
    const rest = content.slice(headingAt + 1);
    return [inline, ...rest].filter((line) => line.trim() !== "").join("\n");
  }

  const listLines = content.filter((line) => LIST_LINE.test(line));
  if (listLines.length > 0) return listLines.join("\n");

  return content.filter((line) => line.trim() !== "").join("\n");
}

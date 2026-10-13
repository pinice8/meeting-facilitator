import { describe, expect, it } from "vitest";
import { extractAgendaFromInvite } from "./invite";

const TEAMS_FOOTER = `
________________________________________________________________________________
Microsoft Teams Need help?
Join the meeting now
Meeting ID: 123 456 789 000
Passcode: abc123
________________________________________________________________________________`;

describe("extractAgendaFromInvite", () => {
  it("takes the lines after an Agenda heading and drops the Teams footer", () => {
    const body = `Hi all,\n\nAgenda:\n- Intro 5\n- Demo 15\n- Q&A\n${TEAMS_FOOTER}`;
    expect(extractAgendaFromInvite(body)).toBe("- Intro 5\n- Demo 15\n- Q&A");
  });

  it("supports an inline first item after the heading", () => {
    expect(extractAgendaFromInvite("Agenda: Intro\nDemo")).toBe("Intro\nDemo");
  });

  it("falls back to list-like lines when there is no heading", () => {
    const body = `Let's sync.\n1. Status\n2. Risks\nThanks${TEAMS_FOOTER}`;
    expect(extractAgendaFromInvite(body)).toBe("1. Status\n2. Risks");
  });

  it("falls back to the remaining text when there is no list", () => {
    expect(extractAgendaFromInvite(`Status\nRisks${TEAMS_FOOTER}`)).toBe("Status\nRisks");
  });

  it("returns an empty string for an invite with only the Teams footer", () => {
    expect(extractAgendaFromInvite(TEAMS_FOOTER)).toBe("");
  });
});

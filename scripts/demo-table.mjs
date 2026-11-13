// The README's guided-demo table, from schema/demo-record.json. Shared by
// scripts/demo-record.mjs (which writes it) and src/lib/sync.test.ts (which
// fails `make check` when the README and the record disagree).

export const DEMO_START = "<!-- demo-record:start -->";
export const DEMO_END = "<!-- demo-record:end -->";

/** The table with its markers, indented to sit inside the README's list item. */
export function demoTable(record) {
  const n = (v) => v.toFixed(1);
  return [
    DEMO_START,
    "  | Demo check | Truth | Measured |",
    "  |---|---|---|",
    ...record.checks.map((c) => `  | ${c.label} | ${n(c.truth)} ${c.unit} | ${n(c.measured)} ${c.unit} |`),
    "",
    `  Measured by \`make demo-record\` against argus-survey ${record.survey.version} @ \`${record.survey.commit.slice(0, 7)}\`.`,
    `  ${DEMO_END}`,
  ].join("\n");
}

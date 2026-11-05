#!/usr/bin/env node
// PreToolUse hook for Bash (main agent and every subagent: project settings apply to both).
// Blocks the command shapes that left agents hanging for hours:
//  1. wait loops (`until/while ...; do sleep`), including `pgrep -f` loops that match themselves;
//  2. long project commands (visual tests, sims, playwright) without a `timeout` in front.
// Exit 2 = block; stderr is sent back to the agent as the reason.
let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let cmd = '';
  try { cmd = JSON.parse(raw).tool_input?.command ?? ''; } catch { process.exit(0); }
  const flat = cmd.replace(/\s+/g, ' ');
  // Ignore quoted text (commit messages, grep patterns) when looking for loops.
  const code = flat.replace(/"[^"]*"|'[^']*'/g, '""');
  const waitLoop = /(^|[;&|(\s])(until|while)\s[^;]*;?\s*do\s+(sleep|:)/.test(code) ||
    /(^|[;&|(\s])(until|while)\s[^;]*p(grep|kill)\s+-f/.test(code);
  if (waitLoop) {
    console.error(`BLOCKED: wait loops (until/while ... sleep, pgrep -f loops) hang agents for hours.
Run the command in the foreground with a limit instead:
  timeout 900 npm run test:visual -- <name>
or start it and wait on its pid:
  cmd & pid=$!; wait $pid
For long jobs use run_in_background and wait for the completion notice; never poll.`);
    process.exit(2);
  }
  const long = /npm run (test:visual|sim)\b|npx playwright|(node|tsx|vite-node)\s+\S*(scripts\/visual\/run\.mjs|tools\/sim\/)/.test(code);
  const limited = /(^|[;&|(\s])timeout\s+(-\S+\s+)*\d/.test(code);
  if (long && !limited) {
    console.error(`BLOCKED: long project commands need a time limit so they cannot hang.
Prefix them with timeout, e.g.: timeout 900 npm run test:visual -- <name>
(sims: timeout 600 npm run sim -- ...; full visual suite: timeout 2700).`);
    process.exit(2);
  }
  process.exit(0);
});

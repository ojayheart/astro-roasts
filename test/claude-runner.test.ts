import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import test from "node:test";
import { claudeArgs, hasCalculatedChart, runClaude } from "../ops/hermes-roast-runner/claude.js";

function fixture(source: string) {
  let cwd = "";
  return {
    deps: {
      spawnProcess(_command: string, args: string[], options: any) {
        cwd = options.cwd;
        return spawn(process.execPath, ["--input-type=module", "-e", source, "--", ...args], options);
      },
    },
    cleaned: () => assert.equal(existsSync(cwd), false),
  };
}

const result = (fields: string) =>
  `console.log(JSON.stringify({ type: 'result', is_error: false, ${fields} }));`;

test("pins Fable 5.2 and separates chart tools from text-only calls", () => {
  for (const tools of ["", "Bash,WebSearch"]) {
    const args = claudeArgs({ tools });
    assert.equal(args[args.indexOf("--model") + 1], "claude-fable-5-2");
    assert.equal(args[args.indexOf("--effort") + 1], "high");
    assert.equal(args[args.indexOf("--tools") + 1], tools);
    assert.equal(args[args.indexOf("--setting-sources") + 1], "");
    assert.ok(args.includes("--strict-mcp-config"));
    assert.ok(args.includes("--no-session-persistence"));
  }
  assert.ok(claudeArgs({ systemPrompt: "voice" }).includes("--append-system-prompt"));
  assert.ok(claudeArgs({ systemPrompt: "voice", replaceSystemPrompt: true }).includes("--system-prompt"));
  assert.equal(claudeArgs({ effort: "low" }).at(claudeArgs({}).indexOf("--effort") + 1), "low");
});

test("returns only the final answer, pipes input, hides service secrets and cleans workspace", async () => {
  const f = fixture(`
    let input = '';
    for await (const chunk of process.stdin) input += chunk;
    if (process.env.ROAST_RUNNER_SECRET) process.exit(9);
    console.error('tool chatter, not the roast');
    ${result("result: 'FINAL: ' + input")}
  `);
  const previous = process.env.ROAST_RUNNER_SECRET;
  process.env.ROAST_RUNNER_SECRET = "test-secret";
  try {
    const run = await runClaude({ userPrompt: "birth data", tools: "" }, f.deps);
    assert.equal(run.code, 0);
    assert.equal(run.stdout, "FINAL: birth data");
    f.cleaned();
  } finally {
    if (previous === undefined) delete process.env.ROAST_RUNNER_SECRET;
    else process.env.ROAST_RUNNER_SECRET = previous;
  }
});

test("error results keep usage-limit diagnostics and return no output", async () => {
  const f = fixture(`console.log(JSON.stringify({ type: 'result', is_error: true, result: 'Claude usage limit reached' })); process.exit(1);`);
  const run = await runClaude({ userPrompt: "test" }, f.deps);
  assert.notEqual(run.code, 0);
  assert.equal(run.stdout, "");
  assert.match(run.stderr, /usage limit/);
  f.cleaned();
});

test("an error result fails even when the CLI exits zero", async () => {
  const f = fixture(`console.log(JSON.stringify({ type: 'result', is_error: true, result: 'overloaded' }));`);
  const run = await runClaude({ userPrompt: "test" }, f.deps);
  assert.equal(run.code, -1);
  assert.equal(run.stdout, "");
});

test("missing, malformed or empty final output fails closed", async () => {
  for (const source of ["process.exit(0)", "console.log('not json')", result("result: '  '")]) {
    const f = fixture(source);
    const run = await runClaude({ userPrompt: "test" }, f.deps);
    assert.equal(run.code, -1);
    assert.equal(run.stdout, "");
    f.cleaned();
  }
});

test("hung CLI is terminated and its workspace removed", async () => {
  const f = fixture("setInterval(() => {}, 1000)");
  const run = await runClaude({ userPrompt: "test", timeoutMs: 100 }, f.deps);
  assert.equal(run.code, -1);
  assert.equal(run.stderr, "claude_timeout");
  f.cleaned();
});

test("spawn errors return a failure instead of crashing the runner", async () => {
  const run = await runClaude({ userPrompt: "test" }, {
    spawnProcess: (_command: string, _args: string[], options: any) => spawn("/nonexistent-claude-test", [], options),
  });
  assert.equal(run.code, -1);
  assert.match(run.stderr, /ENOENT/);
});

test("a dead subscription login is reported as an authentication failure, not a rate limit", async () => {
  const f = fixture(`console.log(JSON.stringify({ type: 'result', is_error: true, result: 'Your organization does not have access to Claude. Please login again or contact your administrator. request 429abc' })); process.exit(1);`);
  const run = await runClaude({ userPrompt: "test" }, f.deps);
  assert.match(run.stderr, /^claude_authentication_failed/);
  assert.doesNotMatch(run.stderr, /429/);
  f.cleaned();
});

test("requires calculated placements, not a marked-up calculator failure", () => {
  assert.equal(hasCalculatedChart("Chart unavailable: permission denied"), false);
  assert.equal(hasCalculatedChart("Sun in Taurus, Moon in Sagittarius"), false);
  assert.equal(hasCalculatedChart("  Sun 21°27' Taurus\n  Moon 20°21' Sagittarius"), true);
});

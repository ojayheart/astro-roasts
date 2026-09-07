import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import test from "node:test";
import { codexArgs, hasCalculatedChart, runCodex } from "../ops/hermes-roast-runner/codex.js";

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

const writeOutput = `
  import { writeFileSync } from 'node:fs';
  const args = process.argv.slice(1);
  const output = args[args.indexOf('--output-last-message') + 1];
`;

test("pins Astra high and separates chart tools from text-only calls", () => {
  for (const tools of ["", "Bash,WebSearch,Skill"]) {
    const args = codexArgs({ tools }, "/tmp/answer");
    assert.equal(args[args.indexOf("--model") + 1], "gpt-6-astra");
    assert.ok(args.includes("model_reasoning_effort=high"));
    assert.ok(args.includes(`features.shell_tool=${Boolean(tools)}`));
    assert.ok(args.includes(`web_search=\"${tools ? "live" : "disabled"}\"`));
    assert.ok(args.includes("--ignore-user-config"));
    assert.ok(args.includes("--ephemeral"));
    assert.equal(args.at(-1), "-");
  }
});

test("returns only final output, pipes input, hides service secrets and cleans workspace", async () => {
  const f = fixture(writeOutput + `
    let input = '';
    for await (const chunk of process.stdin) input += chunk;
    if (process.env.ROAST_RUNNER_SECRET) process.exit(9);
    console.log('intermediate commentary, not the roast');
    writeFileSync(output, 'FINAL: ' + input);
  `);
  const previous = process.env.ROAST_RUNNER_SECRET;
  process.env.ROAST_RUNNER_SECRET = "test-secret";
  try {
    const result = await runCodex({ userPrompt: "birth data", tools: "" }, f.deps);
    assert.equal(result.code, 0);
    assert.equal(result.stdout, "FINAL: birth data");
    f.cleaned();
  } finally {
    if (previous === undefined) delete process.env.ROAST_RUNNER_SECRET;
    else process.env.ROAST_RUNNER_SECRET = previous;
  }
});

test("nonzero CLI exit preserves rate-limit diagnostics and rejects partial output", async () => {
  const f = fixture(writeOutput + `writeFileSync(output, 'partial'); console.error('usage limit reached'); process.exit(2);`);
  const result = await runCodex({ userPrompt: "test" }, f.deps);
  assert.equal(result.code, 2);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /usage limit/);
  f.cleaned();
});

test("missing or empty final output fails closed", async () => {
  for (const source of ["process.exit(0)", writeOutput + "writeFileSync(output, '  ')"]) {
    const f = fixture(source);
    const result = await runCodex({ userPrompt: "test" }, f.deps);
    assert.equal(result.code, -1);
    assert.equal(result.stdout, "");
    f.cleaned();
  }
});

test("hung CLI is terminated and its workspace removed", async () => {
  const f = fixture("setInterval(() => {}, 1000)");
  const result = await runCodex({ userPrompt: "test", timeoutMs: 100 }, f.deps);
  assert.equal(result.code, -1);
  assert.equal(result.stderr, "codex_timeout");
  f.cleaned();
});

test("spawn errors return a failure instead of crashing the runner", async () => {
  const result = await runCodex({ userPrompt: "test" }, {
    spawnProcess: (_command: string, _args: string[], options: any) => spawn('/nonexistent-codex-test', [], options),
  });
  assert.equal(result.code, -1);
  assert.match(result.stderr, /ENOENT/);
});

test("revoked login cannot be misclassified as a rate limit by a numeric request id", async () => {
  const f = fixture("console.error('401 Unauthorized token_revoked request id abc429def'); process.exit(1)");
  const result = await runCodex({ userPrompt: "test" }, f.deps);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /^codex_authentication_failed/);
  assert.doesNotMatch(result.stderr, /429/);
  f.cleaned();
});

test("requires calculated placements, not a marked-up calculator failure", () => {
  assert.equal(hasCalculatedChart("Chart unavailable: bwrap permission denied"), false);
  assert.equal(hasCalculatedChart("Sun in Taurus, Moon in Sagittarius"), false);
  assert.equal(hasCalculatedChart("  Sun 21°27' Taurus\n  Moon 20°21' Sagittarius"), true);
});

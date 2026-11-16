import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

export const CLAUDE_MODEL = "claude-fable-5-2";

// Explicitly load the deployed voice, without relying on Claude's Skill tool.
export async function loadRoastSkill(group = false) {
  const name = group ? "astro-roast-group" : "astro-roast";
  const root = process.env.ROAST_SKILLS_DIR || join(homedir(), ".agents", "skills");
  return readFile(join(root, name, "SKILL.md"), "utf8");
}

// `--tools` limits what exists, not just what is pre-approved: text-only calls
// (DMs, annotations, enrichment) handle untrusted text and get no tools at all.
export function claudeArgs({
  model = CLAUDE_MODEL,
  systemPrompt = "",
  tools = "",
  effort = "high",
  replaceSystemPrompt = false,
}) {
  const args = [
    "-p", "--model", model, "--effort", effort,
    "--output-format", "json",
    "--permission-mode", "bypassPermissions",
    "--tools", tools,
    // Ignore user settings, memory files, skills and MCP servers on the host.
    "--setting-sources", "", "--strict-mcp-config",
    "--disable-slash-commands", "--no-session-persistence",
  ];
  if (systemPrompt) {
    args.push(replaceSystemPrompt ? "--system-prompt" : "--append-system-prompt", systemPrompt);
  }
  return args;
}

// The CLI prints one JSON result object. Only its final answer is returned:
// tool transcripts and intermediate commentary cannot enter a roast.
function parseResult(stdout) {
  try {
    const parsed = JSON.parse(stdout.trim().split("\n").at(-1));
    return parsed?.type === "result" ? parsed : null;
  } catch {
    return null;
  }
}

const AUTH_FAILURE =
  /does not have access to Claude|please (run \/login|login again)|invalid api key|authentication_error|oauth token (has expired|revoked)|not logged in/i;

// Match the runner's {code, stdout, stderr} contract.
/**
 * @param {{ userPrompt: string, model?: string, systemPrompt?: string, tools?: string, effort?: string, replaceSystemPrompt?: boolean, timeoutMs?: number }} options
 * @param {{ spawnProcess?: (command: string, args: string[], options: import("node:child_process").SpawnOptionsWithoutStdio) => import("node:child_process").ChildProcessWithoutNullStreams }} [deps]
 */
export async function runClaude(options, { spawnProcess = spawn } = {}) {
  let dir;
  try {
    dir = await mkdtemp(join(tmpdir(), "astro-roast-claude-"));
    const result = await new Promise((resolve) => {
      const proc = spawnProcess(process.env.CLAUDE_BIN || "claude", claudeArgs(options), {
        cwd: dir,
        detached: true,
        // The subscription login lives in HOME/.claude. Service secrets such as
        // ROAST_RUNNER_SECRET never reach the model's shell.
        env: {
          HOME: homedir(),
          PATH: `/opt/roast-runner/venv/bin:${process.env.PATH || ""}`,
          ...(process.env.USER ? { USER: process.env.USER } : {}), // macOS keychain login
          ...(process.env.CLAUDE_CONFIG_DIR ? { CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR } : {}),
          LANG: "C.UTF-8",
          FORCE_COLOR: "0",
        },
        stdio: ["pipe", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      let timedOut = false;
      let killTimer;
      const kill = (signal) => {
        try { process.kill(-proc.pid, signal); } catch { proc.kill(signal); }
      };
      const timer = setTimeout(() => {
        timedOut = true;
        kill("SIGTERM");
        killTimer = setTimeout(() => kill("SIGKILL"), 5000);
      }, options.timeoutMs || Number(process.env.ROAST_TIMEOUT_MS || 600_000));
      const finish = (code, error = "") => {
        clearTimeout(timer);
        clearTimeout(killTimer);
        resolve(timedOut
          ? { code: -1, stdout: "", stderr: "claude_timeout" }
          : { code, stdout, stderr: error || stderr });
      };
      proc.stdout.on("data", (data) => { stdout += data; });
      proc.stderr.on("data", (data) => { stderr = (stderr + data).slice(-8000); });
      proc.once("error", (error) => finish(-1, String(error)));
      proc.once("close", (code) => finish(code ?? -1));
      proc.stdin.on("error", () => {}); // EPIPE is reported by process exit.
      proc.stdin.end(options.userPrompt);
    });
    if (result.stderr === "claude_timeout") return result;

    // Failures (login, usage limit) arrive as an is_error result on stdout.
    const parsed = parseResult(result.stdout);
    const answer = typeof parsed?.result === "string" ? parsed.result.trim() : "";
    if (result.code !== 0 || !parsed || parsed.is_error) {
      const detail = `${answer} ${result.stderr}`.trim().slice(-8000);
      return {
        code: result.code || -1,
        stdout: "",
        stderr: AUTH_FAILURE.test(detail)
          ? "claude_authentication_failed: sign in again on Hermes"
          : detail || "claude_bad_output",
      };
    }
    if (!answer) return { code: -1, stdout: "", stderr: "claude_empty_output" };
    return { code: 0, stdout: answer, stderr: result.stderr };
  } catch (error) {
    return { code: -1, stdout: "", stderr: String(error) };
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true });
  }
}

// Reject prose explaining a failed calculator run inside otherwise valid markers.
export function hasCalculatedChart(chart) {
  return /^\s*Sun\s+\d{1,2}°\d{2}'/m.test(chart) &&
    /^\s*Moon\s+\d{1,2}°\d{2}'/m.test(chart);
}

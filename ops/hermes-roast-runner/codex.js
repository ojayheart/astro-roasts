import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

export const CODEX_MODEL = "gpt-6-astra";

// Explicitly load the deployed voice, without relying on Claude's Skill tool.
export async function loadRoastSkill(group = false) {
  const name = group ? "astro-roast-group" : "astro-roast";
  const root = process.env.ROAST_SKILLS_DIR || join(homedir(), ".agents", "skills");
  return readFile(join(root, name, "SKILL.md"), "utf8");
}

export function codexArgs({ model = CODEX_MODEL, systemPrompt = "", tools = "" }, outputPath) {
  const args = [
    "exec", "--ignore-user-config", "--skip-git-repo-check", "--ephemeral",
    "--color", "never", "--model", model,
    "--sandbox", tools ? "workspace-write" : "read-only",
    "-c", "model_reasoning_effort=high",
    "-c", `features.shell_tool=${Boolean(tools)}`,
    "-c", `web_search=${JSON.stringify(tools ? "live" : "disabled")}`,
    "-c", "sandbox_workspace_write.network_access=true",
    "--output-last-message", outputPath,
  ];
  if (systemPrompt) args.push("-c", `developer_instructions=${JSON.stringify(systemPrompt)}`);
  args.push("-");
  return args;
}

// Match the runner's {code, stdout, stderr} contract. Only the final answer is
// returned: tool transcripts and intermediate commentary cannot enter a roast.
/**
 * @param {{ userPrompt: string, model?: string, systemPrompt?: string, tools?: string, timeoutMs?: number }} options
 * @param {{ spawnProcess?: (command: string, args: string[], options: import("node:child_process").SpawnOptionsWithoutStdio) => import("node:child_process").ChildProcessWithoutNullStreams }} [deps]
 */
export async function runCodex(options, { spawnProcess = spawn } = {}) {
  let dir;
  try {
    dir = await mkdtemp(join(tmpdir(), "astro-roast-codex-"));
    const outputPath = join(dir, "answer.txt");
    const result = await new Promise((resolve) => {
      const proc = spawnProcess(process.env.CODEX_BIN || "codex", codexArgs(options, outputPath), {
        cwd: dir,
        detached: true,
        env: {
          HOME: homedir(),
          PATH: `/opt/roast-runner/venv/bin:${process.env.PATH || ""}`,
          ...(process.env.CODEX_HOME ? { CODEX_HOME: process.env.CODEX_HOME } : {}),
          LANG: "C.UTF-8",
        },
        stdio: ["pipe", "pipe", "pipe"],
      });
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
        resolve({ code: timedOut ? -1 : code, stderr: timedOut ? "codex_timeout" : error || stderr });
      };
      proc.stdout.resume();
      proc.stderr.on("data", (data) => { stderr = (stderr + data).slice(-8000); });
      proc.once("error", (error) => finish(-1, String(error)));
      proc.once("close", (code) => finish(code ?? -1));
      proc.stdin.on("error", () => {}); // EPIPE is reported by process exit.
      proc.stdin.end(options.userPrompt);
    });
    if (result.code !== 0) {
      const authFailure = /token_revoked|invalidated oauth|401 Unauthorized|refresh_token_reused/i.test(result.stderr);
      return { ...result, stdout: "", stderr: authFailure ? "codex_authentication_failed: sign in again on Hermes" : result.stderr };
    }
    const stdout = (await readFile(outputPath, "utf8")).trim();
    if (!stdout) return { code: -1, stdout: "", stderr: "codex_empty_output" };
    return { ...result, stdout };
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

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, copyFile, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";

test("HTTP runner forwards evidence to the writer and preserves solo/group chart output", { timeout: 15000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), "roast-evidence-test-"));
  let proc: ReturnType<typeof spawn> | undefined;
  try {
    const source = await readFile(new URL("../ops/hermes-roast-runner/server.js", import.meta.url), "utf8");
    await writeFile(join(dir, "package.json"), '{"type":"module"}');
    await writeFile(join(dir, "server.js"), source.replace('console.log(`roast-runner listening', 'console.log(`TEST_PORT=${server.address().port}`); console.log(`roast-runner listening'));
    await copyFile(new URL("../ops/hermes-roast-runner/roast-evidence.js", import.meta.url), join(dir, "roast-evidence.js"));
    await writeFile(join(dir, "enrich-agent.js"), 'export function handleEnrichAgent() {}');
    await writeFile(join(dir, "chart-annotations.js"), 'export function handleChartAnnotations() {}');
    await writeFile(join(dir, "claude.js"), `
      import {writeFileSync} from 'node:fs';
      export const CLAUDE_MODEL='test';
      export const loadRoastSkill=async()=> 'Original voice';
      export const hasCalculatedChart=c=>c.includes('Sun') && c.includes('Moon');
      export async function runClaude(options) {
        writeFileSync('captured.json', JSON.stringify(options));
        const chart="Sun 01°00' Aquarius\\nMoon 01°00' Taurus";
        return {code:0,stderr:'',stdout:
          ['CHART','CHART_1','CHART_2'].map(m=>'---'+m+'_START---\\n'+chart+'\\n---'+m+'_END---').join('\\n')+
          '\\n---ROAST_START---\\nA test roast.\\n---ROAST_END---'};
      }
    `);
    // Stand-ins for the calculators: the runner only checks their output shape.
    await writeFile(join(dir, "natal.cjs"), `console.log("Sun 09°09' Leo\\nMoon 09°09' Libra\\n" + process.argv.slice(2).join(" "))`);
    await writeFile(join(dir, "synastry.cjs"), `let s=''; process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.stringify({schema:2,people:JSON.parse(s).people.length})))`);
    proc = spawn(process.execPath, [join(dir, "server.js")], { cwd: dir, env: { NODE_ENV: "test", PATH: process.env.PATH, PORT: "0", ROAST_RUNNER_SECRET: "test-only", ASTRO_PYTHON: process.execPath, NATAL_CHART_PATH: join(dir, "natal.cjs"), SYNASTRY_PATH: join(dir, "synastry.cjs") }, stdio: ["ignore", "pipe", "pipe"] });
    const port = await new Promise<string>((resolve, reject) => {
      let output = "";
      proc!.stdout!.on("data", data => { output += data; const match = output.match(/TEST_PORT=(\d+)/); if (match) resolve(match[1]); });
      proc!.once("error", reject);
      proc!.once("exit", code => reject(new Error(`server exited ${code}`)));
    });
    const person = { name: "Test", date: "1994-01-21", birthPlace: "Wellington", evidence: { status: "unknown-time" } };
    for (const group of [false, true]) {
      const res = await fetch(`http://127.0.0.1:${port}/roast`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer test-only" }, body: JSON.stringify(group ? { mode: "group", people: [person, person] } : person) });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.roast, "---ROAST_START---\nA test roast.\n---ROAST_END---");
      if (group) assert.equal(body.charts.length, 2);
      else assert.match(body.chartData, /Sun/);
      const call = JSON.parse(await readFile(join(dir, "captured.json"), "utf8"));
      assert.match(call.systemPrompt, /Original voice/);
      assert.match(call.systemPrompt, /Default to ZERO/);
      const evidence = JSON.parse(call.systemPrompt.split("PRIVATE CALCULATED EVIDENCE (do not reproduce in customer prose):\n")[1]);
      assert.equal(evidence.length, group ? 2 : 1);
      assert.equal(evidence[0].evidence.status, "unknown-time");
      // No resolved place: the writer keeps its lookup and calculator tools.
      assert.equal(call.tools, "Bash,WebSearch");
      assert.equal(body.fastPath, false);
    }

    // Resolved place: the runner casts the charts and the writer gets no tools.
    const timed = { ...person, time: "13:00", hasBirthTime: true, evidence: { status: "calculated", birth: { lat: -41.29, lon: 174.78, tz: "Pacific/Auckland" } } };
    const located = { ...person, coords: { lat: 38.72, lon: -9.14, tz: "Europe/Lisbon" } };
    for (const group of [false, true]) {
      const res = await fetch(`http://127.0.0.1:${port}/roast`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer test-only" }, body: JSON.stringify(group ? { mode: "group", people: [timed, located] } : timed) });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.fastPath, true);
      assert.equal(body.roast, "---ROAST_START---\nA test roast.\n---ROAST_END---");
      assert.match(group ? body.charts[1] : body.chartData, group ? /^Sun 09°09' Leo\n[^]*--lat 38.72 --lon -9.14 --tz Europe\/Lisbon$/ : /^Sun 09°09' Leo\n[^]*--hour 13 --minute 0$/);
      const call = JSON.parse(await readFile(join(dir, "captured.json"), "utf8"));
      assert.equal(call.tools, "");
      assert.match(call.userPrompt, /Sun 09°09' Leo/);
      if (group) assert.match(call.userPrompt, /synastry_offline\.py output:\n\{"schema":2,"people":2\}/);
    }
  } finally {
    if (proc && proc.exitCode === null) { proc.kill(); await once(proc, "exit"); }
    await rm(dir, { recursive: true, force: true });
  }
});

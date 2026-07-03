"use client";

import { useEffect, useRef } from "react";

/**
 * POC — WebGL particle field for astroroast branding.
 *
 * A glowing orb of blood/ash embers, slowly rotating, soft additive glow.
 * Self-contained raw WebGL (no three.js). Recoloured + simplified from the
 * Astrelle reference pen so it sits behind the hero headline as ambience.
 *
 * Respects prefers-reduced-motion (renders one static frame), pauses when the
 * tab is hidden, and no-ops cleanly if WebGL is unavailable.
 */

// ── tunables ────────────────────────────────────────────────────────────────
const MAIN_COUNT = 3500; // filled orb
const STAR_COUNT = 1400; // sparse outer twinkle
const CAM_Z = 3.6;
const PERSP = 2.6;
const ROT_SPEED = 0.08; // radians/sec
const TILT = 0.32; // fixed lean toward camera

const VERT = `
attribute vec3 aPos;
attribute vec3 aColor;
attribute float aSeed;
uniform float uTime;
uniform float uAngle;
uniform vec2 uRes;
uniform float uDpr;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vColor = aColor;
  vec3 p = aPos;
  // rotate around Y
  float s = sin(uAngle), c = cos(uAngle);
  vec3 r = vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
  // fixed tilt around X
  float st = sin(${TILT.toFixed(3)}), ct = cos(${TILT.toFixed(3)});
  r = vec3(r.x, ct * r.y - st * r.z, st * r.y + ct * r.z);
  // simple perspective (camera at +z looking down -z)
  float zEye = max(${CAM_Z.toFixed(2)} - r.z, 0.1);
  float persp = ${PERSP.toFixed(2)} / zEye;
  float aspect = uRes.x / uRes.y;
  vec2 clip = vec2(r.x * persp / aspect, r.y * persp);
  gl_Position = vec4(clip, 0.0, 1.0);
  float pulse = 0.6 + 0.4 * sin(uTime * 1.4 + aSeed * 6.2831);
  gl_PointSize = (1.5 + 5.0 * persp) * pulse * uDpr;
  vAlpha = clamp(persp * 0.85, 0.12, 1.0);
}
`;

const FRAG = `
precision mediump float;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 d = gl_PointCoord - vec2(0.5);
  float r = length(d);
  if (r > 0.5) discard;
  float a = (1.0 - smoothstep(0.0, 0.5, r)) * vAlpha;
  gl_FragColor = vec4(vColor, a);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn("HeroField shader error:", gl.getShaderInfoLog(sh));
    return null;
  }
  return sh;
}

// blood #ff2a00, ash, dim ember — additive blending sums these into a glow.
function buildBuffers() {
  const n = MAIN_COUNT + STAR_COUNT;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const seed = new Float32Array(n);
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);

  for (let i = 0; i < n; i++) {
    const star = i >= MAIN_COUNT;
    const radius = star
      ? rnd(1.25, 1.75) // outer shell
      : 1.0 * Math.cbrt(Math.random()); // filled orb
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    pos[i * 3 + 2] = radius * Math.cos(phi);

    let r: number, g: number, b: number;
    if (star) {
      const d = rnd(0.18, 0.4); // dim ash twinkle
      r = d;
      g = d;
      b = d * 0.9;
    } else {
      const k = Math.random();
      if (k < 0.12) {
        const w = rnd(0.7, 1.0); // ash sparks
        r = w;
        g = w;
        b = w;
      } else if (k < 0.62) {
        const m = rnd(0.55, 1.0); // blood
        r = 1.0 * m;
        g = 0.165 * m;
        b = 0.0;
      } else {
        const m = rnd(0.25, 0.6); // dim ember
        r = 0.55 * m;
        g = 0.09 * m;
        b = 0.0;
      }
    }
    col[i * 3] = r;
    col[i * 3 + 1] = g;
    col[i * 3 + 2] = b;
    seed[i] = Math.random();
  }
  return { pos, col, seed, count: n };
}

export default function HeroField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = (canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
    }) ||
      canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return; // no WebGL → render nothing

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const { pos, col, seed, count } = buildBuffers();
    const mkBuf = (data: Float32Array, attr: string, size: number) => {
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, attr);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      return buf;
    };
    mkBuf(pos, "aPos", 3);
    mkBuf(col, "aColor", 3);
    mkBuf(seed, "aSeed", 1);

    const uTime = gl.getUniformLocation(prog, "uTime");
    const uAngle = gl.getUniformLocation(prog, "uAngle");
    const uRes = gl.getUniformLocation(prog, "uRes");
    const uDpr = gl.getUniformLocation(prog, "uDpr");

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // additive

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let raf = 0;
    let angle = 0;
    let last = performance.now();
    const draw = (time: number) => {
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      if (!document.hidden) angle += dt * ROT_SPEED;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uTime, time / 1000);
      gl.uniform1f(uAngle, angle);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uDpr, dpr);
      gl.drawArrays(gl.POINTS, 0, count);
      raf = requestAnimationFrame(draw);
    };

    if (reduce) {
      // one static frame
      resize();
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uTime, 0);
      gl.uniform1f(uAngle, 0.6);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uDpr, dpr);
      gl.drawArrays(gl.POINTS, 0, count);
    } else {
      raf = requestAnimationFrame(draw);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      const lose = gl.getExtension("WEBGL_lose_context");
      lose?.loseContext();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
    />
  );
}

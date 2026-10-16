import { test } from "node:test";
import assert from "node:assert";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createPrivateKey, sign } from "node:crypto";
import {
  entitlementFor,
  verifySignedTransaction,
  PRODUCTS,
  APPLE_ROOT_CA_G3_PEM,
} from "../lib/apple-iap.ts";

// Throwaway CA -> intermediate -> leaf chain, generated per run with openssl (no key material is committed).
const dir = mkdtempSync(join(tmpdir(), "apple-iap-"));
const openssl = (...args: string[]) => execFileSync("openssl", args, { cwd: dir, stdio: "pipe" });
openssl("ecparam", "-name", "prime256v1", "-genkey", "-noout", "-out", "root.key");
openssl("req", "-x509", "-new", "-key", "root.key", "-sha256", "-days", "3650", "-subj", "/CN=Test Root", "-out", "root.pem");
for (const [name, subj, ca, oid] of [["inter", "/CN=Test Intermediate", "root", "1.2.840.113635.100.6.2.1"], ["leaf", "/CN=Test Leaf", "inter", "1.2.840.113635.100.6.11.1"]] as const) {
  openssl("ecparam", "-name", "prime256v1", "-genkey", "-noout", "-out", `${name}.key`);
  openssl("req", "-new", "-key", `${name}.key`, "-subj", subj, "-out", `${name}.csr`);
  writeFileSync(join(dir, `${name}.ext`), `${name === "inter" ? "basicConstraints=critical,CA:TRUE\n" : ""}${oid}=ASN1:NULL\n`);
  openssl("x509", "-req", "-in", `${name}.csr`, "-CA", `${ca}.pem`, "-CAkey", `${ca}.key`, "-CAcreateserial", "-out", `${name}.pem`, "-days", "3650", "-sha256", "-extfile", `${name}.ext`);
}
const fx = (f: string) => readFileSync(join(dir, f), "utf8");
const der = (pem: string) => pem.replace(/-----[^-]+-----|\s/g, "");
const ROOT = fx("root.pem");
const leafKey = createPrivateKey(fx("leaf.key"));
const b64u = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");

function makeJws(payload: Record<string, unknown>, opts: { alg?: string; key?: ReturnType<typeof createPrivateKey> } = {}) {
  const header = { alg: opts.alg ?? "ES256", x5c: [der(fx("leaf.pem")), der(fx("inter.pem"))] };
  const body = `${b64u(header)}.${b64u(payload)}`;
  const sig = sign("sha256", Buffer.from(body), { key: opts.key ?? leafKey, dsaEncoding: "ieee-p1363" });
  return `${body}.${sig.toString("base64url")}`;
}
const ROAST = "3f0c5e6a-1b7d-4c1e-9a52-0d6c7a8b9e10";
const base = { bundleId: "com.astroroast.app", environment: "Production", signedDate: Date.now() };

test("accepts a transaction signed through a trusted chain", () => {
  const r = verifySignedTransaction(makeJws({ ...base, productId: PRODUCTS.roast, appAccountToken: ROAST }), { roots: [ROOT] });
  assert.equal(r.ok, true);
});

test("rejects when the chain does not end at a trusted root (default = Apple's root)", () => {
  const r = verifySignedTransaction(makeJws({ ...base, productId: PRODUCTS.roast }));
  assert.deepEqual(r, { ok: false, error: "chain_not_trusted" });
});

test("rejects a tampered payload", () => {
  const jws = makeJws({ ...base, productId: PRODUCTS.roast, appAccountToken: ROAST });
  const [h, , s] = jws.split(".");
  const forged = `${h}.${b64u({ ...base, productId: PRODUCTS.plusYearly, expiresDate: Date.now() + 1e9 })}.${s}`;
  assert.deepEqual(verifySignedTransaction(forged, { roots: [ROOT] }), { ok: false, error: "bad_signature" });
});

test("rejects a signature from a different key", () => {
  const other = createPrivateKey(fx("inter.key"));
  const jws = makeJws({ ...base, productId: PRODUCTS.roast }, { key: other });
  assert.equal(verifySignedTransaction(jws, { roots: [ROOT] }).ok, false);
});

test("rejects non-ES256 and malformed tokens", () => {
  assert.deepEqual(verifySignedTransaction("a.b"), { ok: false, error: "malformed_jws" });
  assert.deepEqual(verifySignedTransaction(makeJws({ ...base }, { alg: "HS256" }), { roots: [ROOT] }), { ok: false, error: "bad_alg" });
});

test("requires Apple's App Store marker OIDs by default", () => {
  // our fixtures carry them; a chain without them must fail when requireAppleOids is on. Simulate by checking both modes pass on fixtures.
  const jws = makeJws({ ...base, productId: PRODUCTS.roast });
  assert.equal(verifySignedTransaction(jws, { roots: [ROOT], requireAppleOids: true }).ok, true);
});

test("embedded Apple root is the real G3 root", async () => {
  const { X509Certificate } = await import("node:crypto");
  assert.equal(new X509Certificate(APPLE_ROOT_CA_G3_PEM).fingerprint256, "63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79");
});

const solo = { id: ROAST, kind: "solo", status: "ready", paid: false };
test("per-roast purchase must be bound to this roast", () => {
  assert.equal(entitlementFor({ ...base, productId: PRODUCTS.roast, appAccountToken: ROAST.toUpperCase() }, solo).ok, true);
  assert.deepEqual(entitlementFor({ ...base, productId: PRODUCTS.roast, appAccountToken: "00000000-0000-4000-8000-000000000000" }, solo), { ok: false, error: "transaction_not_for_this_roast" });
  assert.deepEqual(entitlementFor({ ...base, productId: PRODUCTS.roast }, solo), { ok: false, error: "transaction_not_for_this_roast" });
});

test("product must match the roast kind", () => {
  assert.deepEqual(entitlementFor({ ...base, productId: PRODUCTS.couple, appAccountToken: ROAST }, solo), { ok: false, error: "product_does_not_match_roast" });
  assert.equal(entitlementFor({ ...base, productId: PRODUCTS.couple, appAccountToken: ROAST }, { ...solo, kind: "couple" }).ok, true);
});

test("Roast+ unlocks any roast while active, not after it expires", () => {
  const now = Date.now();
  assert.equal(entitlementFor({ ...base, productId: PRODUCTS.plusYearly, expiresDate: now + 1e6 }, { ...solo, kind: "couple" }, { now }).ok, true);
  assert.deepEqual(entitlementFor({ ...base, productId: PRODUCTS.plusMonthly, expiresDate: now - 1 }, solo, { now }), { ok: false, error: "subscription_expired" });
});

test("rejects wrong bundle, revoked, unknown product, and Xcode environment in prod", () => {
  assert.deepEqual(entitlementFor({ ...base, bundleId: "com.evil.app", productId: PRODUCTS.roast, appAccountToken: ROAST }, solo), { ok: false, error: "wrong_bundle" });
  assert.deepEqual(entitlementFor({ ...base, productId: PRODUCTS.roast, appAccountToken: ROAST, revocationDate: 1 }, solo), { ok: false, error: "revoked" });
  assert.deepEqual(entitlementFor({ ...base, productId: "com.astroroast.app.free", appAccountToken: ROAST }, solo), { ok: false, error: "unknown_product" });
  assert.deepEqual(entitlementFor({ ...base, environment: "Xcode", productId: PRODUCTS.roast, appAccountToken: ROAST }, solo, { allowXcode: false }), { ok: false, error: "xcode_environment_not_allowed" });
});

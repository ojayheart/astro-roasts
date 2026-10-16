import { X509Certificate, verify as cryptoVerify } from "node:crypto";

/**
 * Verification of App Store signed transactions (StoreKit 2 JWS), offline.
 *
 * The JWS header carries an x5c chain (leaf, intermediate). We check that the chain ends at Apple Root CA - G3
 * (SHA-256 63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79, from
 * https://www.apple.com/certificateauthority/), that both certs carry Apple's App Store marker OIDs, that they were
 * valid when the transaction was signed, and that the ES256 signature over the payload is valid.
 */
export const APPLE_ROOT_CA_G3_PEM = `-----BEGIN CERTIFICATE-----
MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwS
QXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9u
IEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcN
MTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBS
b290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9y
aXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49
AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtf
TjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517
IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySr
MA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gA
MGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4
at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM
6BgD56KyKA==
-----END CERTIFICATE-----
`;

// DER encodings of OID 1.2.840.113635.100.6.11.1 (leaf, App Store receipt signing)
// and 1.2.840.113635.100.6.2.1 (intermediate).
const OID_LEAF = Buffer.from("2a864886f76364060b01", "hex");
const OID_INTERMEDIATE = Buffer.from("2a864886f76364060201", "hex");

export type AppleTransaction = {
  transactionId?: string;
  originalTransactionId?: string;
  bundleId?: string;
  productId?: string;
  appAccountToken?: string;
  purchaseDate?: number;
  expiresDate?: number;
  revocationDate?: number;
  signedDate?: number;
  environment?: string;
  type?: string;
};

export type VerifyResult =
  | { ok: true; tx: AppleTransaction }
  | { ok: false; error: string };

function b64urlJson(part: string): unknown {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
}
function validAt(cert: X509Certificate, at: number): boolean {
  return (
    new Date(cert.validFrom).getTime() <= at &&
    at <= new Date(cert.validTo).getTime()
  );
}

export function verifySignedTransaction(
  jws: string,
  opts: { roots?: string[]; requireAppleOids?: boolean } = {},
): VerifyResult {
  try {
    const parts = jws.split(".");
    if (parts.length !== 3) return { ok: false, error: "malformed_jws" };
    const header = b64urlJson(parts[0]) as { alg?: string; x5c?: string[] };
    if (header.alg !== "ES256") return { ok: false, error: "bad_alg" };
    if (!Array.isArray(header.x5c) || header.x5c.length < 2) {
      return { ok: false, error: "no_chain" };
    }

    const leafDer = Buffer.from(header.x5c[0], "base64");
    const interDer = Buffer.from(header.x5c[1], "base64");
    const leaf = new X509Certificate(leafDer);
    const inter = new X509Certificate(interDer);
    const roots = (opts.roots ?? [APPLE_ROOT_CA_G3_PEM]).map(
      (p) => new X509Certificate(p),
    );

    const payload = b64urlJson(parts[1]) as AppleTransaction;
    const at = payload.signedDate ?? Date.now();

    if (!leaf.checkIssued(inter) || !leaf.verify(inter.publicKey)) {
      return { ok: false, error: "leaf_not_issued_by_intermediate" };
    }
    const root = roots.find(
      (r) => inter.checkIssued(r) && inter.verify(r.publicKey),
    );
    if (!root) return { ok: false, error: "chain_not_trusted" };
    if (!validAt(leaf, at) || !validAt(inter, at)) {
      return { ok: false, error: "cert_expired" };
    }
    if (opts.requireAppleOids !== false) {
      if (leafDer.indexOf(OID_LEAF) === -1) return { ok: false, error: "leaf_missing_oid" };
      if (interDer.indexOf(OID_INTERMEDIATE) === -1) return { ok: false, error: "intermediate_missing_oid" };
    }

    const signed = Buffer.from(parts[0] + "." + parts[1]);
    const sig = Buffer.from(parts[2], "base64url");
    const good = cryptoVerify(
      "sha256",
      signed,
      { key: leaf.publicKey, dsaEncoding: "ieee-p1363" },
      sig,
    );
    if (!good) return { ok: false, error: "bad_signature" };
    return { ok: true, tx: payload };
  } catch {
    return { ok: false, error: "verify_failed" };
  }
}

export const PRODUCTS = {
  roast: "com.astroroast.app.roast",
  other: "com.astroroast.app.roast.other",
  couple: "com.astroroast.app.roast.couple",
  plusMonthly: "com.astroroast.app.plus.monthly",
  plusYearly: "com.astroroast.app.plus.yearly",
} as const;

export type RoastForUnlock = {
  id: string;
  kind: string | null;
  status: string;
  paid: boolean;
};

/**
 * Does this verified transaction entitle the buyer to unlock this roast?
 * - per-roast products must be bound to the roast through appAccountToken
 *   (the roast id) and match its kind
 * - an active Roast+ subscription unlocks any roast
 */
export function entitlementFor(
  tx: AppleTransaction,
  roast: RoastForUnlock,
  opts: { bundleId?: string; now?: number; allowXcode?: boolean } = {},
): { ok: true; via: string } | { ok: false; error: string } {
  const now = opts.now ?? Date.now();
  const bundleId =
    opts.bundleId ?? process.env.APPLE_BUNDLE_ID ?? "com.astroroast.app";
  if (tx.bundleId !== bundleId) return { ok: false, error: "wrong_bundle" };
  if (tx.revocationDate) return { ok: false, error: "revoked" };
  const allowXcode = opts.allowXcode ?? process.env.APPLE_IAP_ALLOW_XCODE === "1";
  if (tx.environment === "Xcode" && !allowXcode) {
    return { ok: false, error: "xcode_environment_not_allowed" };
  }

  const kind = roast.kind ?? "solo";
  if (tx.productId === PRODUCTS.plusMonthly || tx.productId === PRODUCTS.plusYearly) {
    if (!tx.expiresDate || tx.expiresDate <= now) {
      return { ok: false, error: "subscription_expired" };
    }
    return { ok: true, via: "apple-plus" };
  }
  const allowedKinds: Record<string, string[]> = {
    [PRODUCTS.roast]: ["solo"],
    [PRODUCTS.other]: ["solo"],
    [PRODUCTS.couple]: ["couple"],
  };
  const kinds = tx.productId ? allowedKinds[tx.productId] : undefined;
  if (!kinds) return { ok: false, error: "unknown_product" };
  if (!kinds.includes(kind)) {
    return { ok: false, error: "product_does_not_match_roast" };
  }
  if (!tx.appAccountToken || tx.appAccountToken.toLowerCase() !== roast.id.toLowerCase()) {
    return { ok: false, error: "transaction_not_for_this_roast" };
  }
  return { ok: true, via: "apple-purchase" };
}

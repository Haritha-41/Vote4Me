const encoder = new TextEncoder();

const HASH_PREFIX = "pbkdf2_sha256";
const ACCESS_CODE_HASH_ITERATIONS = 310000;
const ACCESS_CODE_HASH_BYTES = 32;
const SALT_BYTES = 16;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error("Invalid hexadecimal input.");
  }

  const bytes = new Uint8Array(hex.length / 2);

  for (let index = 0; index < hex.length; index += 2) {
    bytes[index / 2] = Number.parseInt(hex.slice(index, index + 2), 16);
  }

  return bytes;
}

function timingSafeEqual(valueA: string, valueB: string): boolean {
  if (valueA.length !== valueB.length) {
    return false;
  }

  let mismatch = 0;

  for (let index = 0; index < valueA.length; index += 1) {
    mismatch |= valueA.charCodeAt(index) ^ valueB.charCodeAt(index);
  }

  return mismatch === 0;
}

async function pbkdf2Sha256({
  secret,
  saltHex,
  iterations,
  keyLengthBytes,
}: {
  secret: string;
  saltHex: string;
  iterations: number;
  keyLengthBytes: number;
}): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(secret), "PBKDF2", false, [
    "deriveBits",
  ]);

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: hexToBytes(saltHex),
      iterations,
    },
    keyMaterial,
    keyLengthBytes * 8,
  );

  return bytesToHex(new Uint8Array(derivedBits));
}

function randomHex(bytes: number): string {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return bytesToHex(value);
}

export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function generateSessionToken(): string {
  return randomHex(32);
}

export async function hashWithSha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return bytesToHex(new Uint8Array(digest));
}

export async function hashAccessCode(accessCode: string): Promise<string> {
  const saltHex = randomHex(SALT_BYTES);
  const hashHex = await pbkdf2Sha256({
    secret: accessCode,
    saltHex,
    iterations: ACCESS_CODE_HASH_ITERATIONS,
    keyLengthBytes: ACCESS_CODE_HASH_BYTES,
  });

  return `${HASH_PREFIX}$${ACCESS_CODE_HASH_ITERATIONS}$${saltHex}$${hashHex}`;
}

export async function verifyAccessCode(accessCode: string, persistedHash: string): Promise<boolean> {
  const segments = persistedHash.split("$");
  if (segments.length !== 4) {
    return false;
  }

  const [prefix, iterationSegment, saltHex, expectedHashHex] = segments;
  if (prefix !== HASH_PREFIX || !iterationSegment || !saltHex || !expectedHashHex) {
    return false;
  }

  const iterations = Number.parseInt(iterationSegment, 10);
  if (!Number.isFinite(iterations) || iterations < 100000) {
    return false;
  }

  const recalculatedHash = await pbkdf2Sha256({
    secret: accessCode,
    saltHex,
    iterations,
    keyLengthBytes: expectedHashHex.length / 2,
  });

  return timingSafeEqual(recalculatedHash, expectedHashHex);
}

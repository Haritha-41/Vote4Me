import { pbkdf2Sync, randomBytes } from "node:crypto";

const [, , rawAccessCode] = process.argv;

if (!rawAccessCode || rawAccessCode.trim().length < 6) {
  console.error("Usage: npm run hash:access-code -- <accessCode>");
  process.exit(1);
}

const accessCode = rawAccessCode.trim();
const iterations = 310000;
const saltHex = randomBytes(16).toString("hex");
const hashHex = pbkdf2Sync(accessCode, Buffer.from(saltHex, "hex"), iterations, 32, "sha256").toString("hex");

process.stdout.write(`pbkdf2_sha256$${iterations}$${saltHex}$${hashHex}\n`);

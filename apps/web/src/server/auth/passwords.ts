import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

const passwordHashVersion = "scrypt-v1";
const saltBytes = 16;
const keyLength = 64;

export async function hashPassword(passphrase: string): Promise<string> {
  const salt = randomBytes(saltBytes);
  const key = (await scrypt(passphrase, salt, keyLength)) as Buffer;

  return [passwordHashVersion, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(passphrase: string, encodedHash: string): Promise<boolean> {
  const [version, saltValue, keyValue] = encodedHash.split("$");

  if (version !== passwordHashVersion || !saltValue || !keyValue) {
    return false;
  }

  const salt = Buffer.from(saltValue, "base64url");
  const expectedKey = Buffer.from(keyValue, "base64url");
  const actualKey = (await scrypt(passphrase, salt, expectedKey.length)) as Buffer;

  if (actualKey.length !== expectedKey.length) {
    return false;
  }

  return timingSafeEqual(actualKey, expectedKey);
}

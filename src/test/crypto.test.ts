// Runs on Node's webcrypto rather than jsdom, which has no crypto.subtle.
// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  b64,
  createVault,
  decryptJSON,
  deriveAuthKey,
  deriveRecoveryAuth,
  encryptJSON,
  normalizeCode,
  rewrapWithNewPassword,
  unb64,
  unlock,
} from "@/lib/crypto";

const USER = "mira.writes";
const PASSWORD = "a-long-enough-password";
const NEW_PASSWORD = "an-even-longer-password";
const PAGE = { title: "Tuesday", body: "Rained all day", at: "2026-10-07T12:00:00.000Z" };
const LONG = 20_000;

describe("journal encryption", () => {
  it(
    "seals content so the plaintext never appears in what the server stores",
    async () => {
      const vault = await createVault(USER, PASSWORD);

      const sealed = await encryptJSON(vault.sessionKey, PAGE);

      expect(sealed).not.toContain("Rained");
      await expect(decryptJSON(vault.sessionKey, sealed)).resolves.toEqual(PAGE);
    },
    LONG,
  );

  it(
    "unlocks the same vault again from the password alone",
    async () => {
      const vault = await createVault(USER, PASSWORD);
      const sealed = await encryptJSON(vault.sessionKey, PAGE);

      const unlocked = await unlock(PASSWORD, vault.keys.pw);

      await expect(decryptJSON(unlocked, sealed)).resolves.toEqual(PAGE);
    },
    LONG,
  );

  it(
    "refuses to unlock with the wrong password",
    async () => {
      const vault = await createVault(USER, PASSWORD);

      await expect(unlock("definitely-not-it", vault.keys.pw)).rejects.toThrow();
    },
    LONG,
  );

  it(
    "recovers the diary with the recovery code and re-wraps it for a new password",
    async () => {
      const vault = await createVault(USER, PASSWORD);
      const sealed = await encryptJSON(vault.sessionKey, PAGE);

      const { pw, sessionKey } = await rewrapWithNewPassword(
        normalizeCode(vault.code),
        vault.keys.rc,
        NEW_PASSWORD,
      );
      await expect(decryptJSON(sessionKey, sealed)).resolves.toEqual(PAGE);

      // The re-wrapped key must open with the new password from a cold start too.
      const reopened = await unlock(NEW_PASSWORD, pw);
      await expect(decryptJSON(reopened, sealed)).resolves.toEqual(PAGE);
    },
    LONG,
  );

  it(
    "refuses to recover with the wrong code",
    async () => {
      const vault = await createVault(USER, PASSWORD);

      await expect(
        rewrapWithNewPassword("AAAA-BBBB-CCCC-DDDD-EEEE", vault.keys.rc, NEW_PASSWORD),
      ).rejects.toThrow();
    },
    LONG,
  );

  it("derives a stable auth key that is different for every username", async () => {
    const first = await deriveAuthKey(USER, PASSWORD);
    const again = await deriveAuthKey(USER, PASSWORD);
    const other = await deriveAuthKey("someone.else", PASSWORD);

    expect(first).toBe(again);
    expect(first).not.toBe(other);
  });

  it("trims and case-folds a pasted recovery code before deriving from it", async () => {
    const vault = await createVault(USER, PASSWORD);
    const messy = ` ${vault.code.toLowerCase().replaceAll("-", " ")} `;

    expect(await deriveRecoveryAuth(USER, messy)).toBe(await deriveRecoveryAuth(USER, vault.code));
  });

  it("round-trips base64 without corrupting high bytes", () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 200, 255, 42]);

    expect([...unb64(b64(bytes))]).toEqual([...bytes]);
  });
});

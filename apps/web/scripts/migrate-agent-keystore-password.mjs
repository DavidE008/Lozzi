import { readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { Wallet, getAddress } from "ethers";

import {
  hardenWindowsFileAcl,
  protectPasswordForCurrentWindowsUser,
  unprotectPasswordForCurrentWindowsUser,
} from "./agentkit-local-secrets.mjs";

if (process.platform !== "win32") {
  throw new Error(
    "This migration is only needed for the legacy Windows setup.",
  );
}

const secretDirectory = path.resolve(process.cwd(), "../../.secrets");
const keystorePath = path.join(
  secretDirectory,
  "lozzi-demo-agent.keystore.json",
);
const legacyPasswordPath = path.join(
  secretDirectory,
  "lozzi-demo-agent.password",
);
const protectedPasswordPath = path.join(
  secretDirectory,
  "lozzi-demo-agent.password.dpapi",
);

const [encryptedKeystore, legacyPassword] = await Promise.all([
  readFile(keystorePath, "utf8"),
  readFile(legacyPasswordPath, "utf8").then((value) => value.trim()),
]);
const wallet = await Wallet.fromEncryptedJson(
  encryptedKeystore,
  legacyPassword,
);
const protectedPassword =
  await protectPasswordForCurrentWindowsUser(legacyPassword);
await writeFile(protectedPasswordPath, `${protectedPassword}\n`, {
  encoding: "utf8",
  flag: "wx",
  mode: 0o600,
});
await hardenWindowsFileAcl(protectedPasswordPath);
await hardenWindowsFileAcl(keystorePath);

const recoveredPassword =
  await unprotectPasswordForCurrentWindowsUser(protectedPassword);
const recoveredWallet = await Wallet.fromEncryptedJson(
  encryptedKeystore,
  recoveredPassword,
);
if (recoveredWallet.address !== wallet.address) {
  throw new Error("The protected credential did not recover the same wallet.");
}

await unlink(legacyPasswordPath);
process.stdout.write(
  `${JSON.stringify(
    {
      address: getAddress(wallet.address),
      legacyPasswordRemoved: true,
      passwordStorage: "Windows DPAPI (CurrentUser)",
    },
    null,
    2,
  )}\n`,
);

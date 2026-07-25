import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { Wallet, getAddress } from "ethers";

import {
  hardenWindowsFileAcl,
  promptHidden,
  protectPasswordForCurrentWindowsUser,
} from "./agentkit-local-secrets.mjs";

const secretDirectory = path.resolve(process.cwd(), "../../.secrets");
const keystorePath = path.join(
  secretDirectory,
  "lozzi-demo-agent.keystore.json",
);
const protectedPasswordPath = path.join(
  secretDirectory,
  "lozzi-demo-agent.password.dpapi",
);

await mkdir(secretDirectory, { recursive: true });

const wallet = Wallet.createRandom();
let password;
let protectedPassword;
if (process.platform === "win32") {
  password = Wallet.createRandom().privateKey.slice(2);
  protectedPassword = await protectPasswordForCurrentWindowsUser(password);
} else {
  password = await promptHidden("New demo-agent keystore passphrase: ");
  const confirmation = await promptHidden("Confirm keystore passphrase: ");
  if (password.length < 16 || password !== confirmation) {
    throw new Error(
      "The keystore passphrase must contain at least 16 characters and match its confirmation.",
    );
  }
}
const encryptedKeystore = await wallet.encrypt(password);

try {
  await writeFile(keystorePath, `${encryptedKeystore}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  await hardenWindowsFileAcl(keystorePath);
  if (protectedPassword) {
    await writeFile(protectedPasswordPath, `${protectedPassword}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    await hardenWindowsFileAcl(protectedPasswordPath);
  }
} catch (error) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "EEXIST"
  ) {
    throw new Error(
      "A Lozzi demo-agent keystore already exists. Refusing to overwrite it.",
    );
  }
  throw error;
}

process.stdout.write(
  `${JSON.stringify(
    {
      address: getAddress(wallet.address),
      chainId: 480,
      keystorePath,
      passwordStorage:
        process.platform === "win32"
          ? "Windows DPAPI (CurrentUser)"
          : "Interactive passphrase only",
      purpose:
        "Message-only AgentKit demo identity; no student or academic commitment linkage",
    },
    null,
    2,
  )}\n`,
);

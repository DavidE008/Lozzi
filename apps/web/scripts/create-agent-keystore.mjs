import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { Wallet, getAddress } from "ethers";

const secretDirectory = path.resolve(process.cwd(), "../../.secrets");
const keystorePath = path.join(
  secretDirectory,
  "lozzi-demo-agent.keystore.json",
);
const passwordPath = path.join(secretDirectory, "lozzi-demo-agent.password");

await mkdir(secretDirectory, { recursive: true });

const wallet = Wallet.createRandom();
const password = randomBytes(32).toString("base64url");
const encryptedKeystore = await wallet.encrypt(password);

try {
  await writeFile(keystorePath, `${encryptedKeystore}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  await writeFile(passwordPath, `${password}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
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
      passwordPath,
      purpose:
        "Message-only AgentKit demo identity; no student or academic commitment linkage",
    },
    null,
    2,
  )}\n`,
);

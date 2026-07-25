import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { createAgentkitClient } from "@worldcoin/agentkit";
import { Wallet } from "ethers";

const secretDirectory = path.resolve(process.cwd(), "../../.secrets");
const keystorePath = path.join(
  secretDirectory,
  "lozzi-demo-agent.keystore.json",
);
const passwordPath = path.join(secretDirectory, "lozzi-demo-agent.password");
const baseUrl =
  process.argv
    .find((argument) => argument.startsWith("--base-url="))
    ?.slice("--base-url=".length) ?? "http://localhost:3000";

const promptHidden = async (prompt) => {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    throw new Error("The delegation token must be entered in a local TTY.");
  }
  process.stdout.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  return new Promise((resolve, reject) => {
    let value = "";
    const onData = (character) => {
      if (character === "\u0003") {
        cleanup();
        reject(new Error("Cancelled."));
        return;
      }
      if (character === "\r" || character === "\n") {
        cleanup();
        process.stdout.write("\n");
        resolve(value);
        return;
      }
      if (character === "\u007f" || character === "\b") {
        value = value.slice(0, -1);
        return;
      }
      value += character;
    };
    const cleanup = () => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    };
    process.stdin.on("data", onData);
  });
};

const [encryptedKeystore, password] = await Promise.all([
  readFile(keystorePath, "utf8"),
  readFile(passwordPath, "utf8").then((value) => value.trim()),
]);
const wallet = await Wallet.fromEncryptedJson(encryptedKeystore, password);
const delegationToken = await promptHidden("One-time Lozzi delegation: ");
if (!/^[A-Za-z0-9_-]{43}$/u.test(delegationToken)) {
  throw new Error("The delegation token is malformed.");
}

const agentkit = createAgentkitClient({
  signer: {
    address: wallet.address,
    chainId: "eip155:480",
    signMessage: (message) => wallet.signMessage(message),
    type: "eip191",
  },
});
const delegatedFetch = (path, init = {}) =>
  agentkit.fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      authorization: `Bearer ${delegationToken}`,
    },
  });

const contextResponse = await delegatedFetch(
  "/api/agentkit/degree-plan/context",
);
if (!contextResponse.ok) {
  throw new Error(
    `Degree-plan context failed with HTTP ${contextResponse.status}. Confirm AgentBook registration and delegation freshness.`,
  );
}
const degreePlan = await contextResponse.json();
const eligibleCourses = degreePlan.requirements
  .filter((requirement) => requirement.eligible && !requirement.completed)
  .slice(0, 3)
  .map((requirement) => requirement.courseCode);

if (!eligibleCourses.length) {
  process.stdout.write(
    `${JSON.stringify(
      {
        eligibleCourseCodes: [],
        outcome: "No pending proposal was created.",
      },
      null,
      2,
    )}\n`,
  );
  process.exitCode = 0;
} else {
  const proposalResponse = await delegatedFetch(
    "/api/agentkit/degree-plan/proposals",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        courseCodes: eligibleCourses,
        summary: `Consider ${eligibleCourses.join(
          ", ",
        )} next. This minimized agent proposal requires assigned-advisor review and does not enroll the student.`,
      }),
    },
  );
  if (!proposalResponse.ok) {
    throw new Error(
      `Degree-plan proposal failed with HTTP ${proposalResponse.status}. No official record was changed.`,
    );
  }
  const proposal = await proposalResponse.json();
  process.stdout.write(
    `${JSON.stringify(
      {
        courseCodes: eligibleCourses,
        proposalId: proposal.proposalId,
        reviewRequired: proposal.reviewRequired,
        status: proposal.status,
      },
      null,
      2,
    )}\n`,
  );
}

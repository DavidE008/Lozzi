import { spawn } from "node:child_process";
import process from "node:process";
import { promisify } from "node:util";

import { execFile } from "node:child_process";

const execFileAsync = promisify(execFile);
const loopbackHosts = new Set(["127.0.0.1", "[::1]", "localhost"]);

export const parseDemoBaseUrl = (candidate) => {
  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw new TypeError("The demo base URL is invalid.");
  }

  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== "/" && url.pathname !== "")
  ) {
    throw new TypeError(
      "The demo base URL must contain only an origin, without credentials, path, query, or fragment.",
    );
  }

  const isLoopbackHttp =
    url.protocol === "http:" && loopbackHosts.has(url.hostname);
  if (url.protocol !== "https:" && !isLoopbackHttp) {
    throw new TypeError(
      "The demo requires HTTPS except for an explicit loopback origin.",
    );
  }

  return url.origin;
};

export const promptHidden = async (prompt) => {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    throw new Error("Secret input requires a local interactive TTY.");
  }
  process.stdout.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  return new Promise((resolve, reject) => {
    let value = "";
    const cleanup = () => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    };
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
    process.stdin.on("data", onData);
  });
};

const runPowerShellSecretTransform = (script, input) =>
  new Promise((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script],
      {
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", () => {
      reject(new Error("Windows secret protection is unavailable."));
    });
    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `Windows secret protection failed with exit code ${code}${
              stderr.trim() ? "." : ""
            }`,
          ),
        );
        return;
      }
      resolve(stdout.trim());
    });
    child.stdin.end(input);
  });

export const protectPasswordForCurrentWindowsUser = async (password) => {
  if (process.platform !== "win32") {
    throw new Error("Windows secret protection is only available on Windows.");
  }
  return runPowerShellSecretTransform(
    "$plain = [Console]::In.ReadToEnd(); $secure = ConvertTo-SecureString $plain -AsPlainText -Force; [Console]::Out.Write((ConvertFrom-SecureString $secure))",
    password,
  );
};

export const unprotectPasswordForCurrentWindowsUser = async (
  protectedPassword,
) => {
  if (process.platform !== "win32") {
    throw new Error("Windows secret protection is only available on Windows.");
  }
  return runPowerShellSecretTransform(
    "$protected = [Console]::In.ReadToEnd().Trim(); $secure = ConvertTo-SecureString $protected; $credential = [System.Net.NetworkCredential]::new('', $secure); [Console]::Out.Write($credential.Password)",
    protectedPassword,
  );
};

export const hardenWindowsFileAcl = async (filePath) => {
  if (process.platform !== "win32") return;
  const username = process.env.USERNAME;
  if (!username) {
    throw new Error("The current Windows account could not be identified.");
  }
  const account = process.env.USERDOMAIN
    ? `${process.env.USERDOMAIN}\\${username}`
    : username;
  await execFileAsync(
    "icacls.exe",
    [filePath, "/inheritance:r", "/grant:r", `${account}:(F)`, "*S-1-5-18:(F)"],
    { windowsHide: true },
  );
};

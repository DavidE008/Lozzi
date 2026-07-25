import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const sourceDirectory = path.resolve("packages/contracts/src");
const forbidden = [
  "Aisha",
  "Mateo",
  "Priya",
  "student@",
  "@lozzi.example",
  "CS 1301",
  "CS 2305",
  "Northstar University",
];

const files = (await readdir(sourceDirectory)).filter((file) =>
  file.endsWith(".sol"),
);
const violations = [];

for (const file of files) {
  const source = await readFile(path.join(sourceDirectory, file), "utf8");
  for (const value of forbidden) {
    if (source.includes(value)) violations.push(`${file}: ${value}`);
  }
}

if (violations.length) {
  console.error(
    `Sensitive fixture strings found in contracts:\n${violations.join("\n")}`,
  );
  process.exit(1);
}

console.log(`Contract privacy check passed (${files.length} source files).`);

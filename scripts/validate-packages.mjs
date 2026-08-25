import { access, readFile, readdir } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const excludedDirectories = new Set([".git", "node_modules"]);
const textExtensions = new Set(["", ".cjs", ".js", ".json", ".md", ".mjs", ".ts", ".txt", ".yaml", ".yml"]);
const forbiddenPatterns = [
  {
    label: "private Score Studio source repository",
    pattern: new RegExp("github\\.com/" + "score-technologies/score-studio(?:\\.git|[/#@\\s]|$)", "i"),
  },
  {
    label: "private source commit identifier",
    pattern: /Score Studio[^\n]{0,100}\b(?:commit|main at)\s+[`'"]?[0-9a-f]{7,40}\b/i,
  },
  {
    label: "absolute developer filesystem path",
    pattern: new RegExp("(?:/" + "Users/[^/\\s]+/|/" + "home/[^/\\s]+/|[A-Za-z]:\\\\" + "Users\\\\[^\\\\\\s]+\\\\)"),
  },
  {
    label: "embedded credential",
    pattern: new RegExp("(?:gh" + "[oprsu]_[A-Za-z0-9]{20,}|github_" + "pat_[A-Za-z0-9_]{20,}|npm_" + "[A-Za-z0-9]{20,}|sk-" + "[A-Za-z0-9]{20,})"),
  },
];

async function validatePublicReleaseHygiene(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (excludedDirectories.has(entry.name)) continue;
    const entryPath = resolve(directory, entry.name);
    const displayPath = relative(root, entryPath);
    if (entry.isSymbolicLink()) {
      throw new Error(`Public release contains a symbolic link: ${displayPath}`);
    }
    if (entry.isDirectory()) {
      await validatePublicReleaseHygiene(entryPath);
      continue;
    }
    if (!entry.isFile() || !textExtensions.has(extname(entry.name).toLowerCase())) continue;
    const content = await readFile(entryPath, "utf8");
    for (const { label, pattern } of forbiddenPatterns) {
      if (pattern.test(content)) throw new Error(`${displayPath} contains ${label}`);
    }
  }
}
const jsonFiles = [
  "package.json",
  "plugins/openai/score-studio/.codex-plugin/plugin.json",
  "plugins/openai/score-studio/.mcp.json",
  "plugins/claude/score-studio/.claude-plugin/plugin.json",
  "plugins/claude/score-studio/.mcp.json",
  "plugins/gemini/score-studio/gemini-extension.json",
  ".claude-plugin/marketplace.json",
];

for (const file of jsonFiles) {
  JSON.parse(await readFile(resolve(root, file), "utf8"));
}

const required = [
  "dist/stdio.js",
  "dist/http.js",
  "plugins/openai/score-studio/skills/score-studio/SKILL.md",
  "plugins/claude/score-studio/skills/score-studio/SKILL.md",
  "plugins/gemini/score-studio/GEMINI.md",
  "LICENSE",
];
await Promise.all(required.map((file) => access(resolve(root, file))));

const openaiSkill = await readFile(resolve(root, required[2]), "utf8");
const claudeSkill = await readFile(resolve(root, required[3]), "utf8");
if (openaiSkill !== claudeSkill) throw new Error("OpenAI and Claude skills drifted");

await validatePublicReleaseHygiene(root);

console.log(`Validated ${jsonFiles.length} manifests and ${required.length} required files.`);

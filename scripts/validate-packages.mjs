import { readFile, access } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
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

console.log(`Validated ${jsonFiles.length} manifests and ${required.length} required files.`);

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
  ".cursor-plugin/marketplace.json",
  "plugins/cursor/score-studio/.cursor-plugin/plugin.json",
  "plugins/cursor/score-studio/mcp.json",
];

const manifests = new Map();
for (const file of jsonFiles) {
  manifests.set(file, JSON.parse(await readFile(resolve(root, file), "utf8")));
}

const required = [
  "dist/stdio.js",
  "dist/http.js",
  "plugins/openai/score-studio/skills/score-studio/SKILL.md",
  "plugins/claude/score-studio/skills/score-studio/SKILL.md",
  "plugins/gemini/score-studio/GEMINI.md",
  "plugins/cursor/score-studio/skills/score-studio/SKILL.md",
  "skills/score-studio/SKILL.md",
  "plugins/hermes/score-studio/config.example.yaml",
  "LICENSE",
];
await Promise.all(required.map((file) => access(resolve(root, file))));

const openaiSkill = await readFile(resolve(root, required[2]), "utf8");
const claudeSkill = await readFile(resolve(root, required[3]), "utf8");
if (openaiSkill !== claudeSkill) throw new Error("OpenAI and Claude skills drifted");

const releaseVersion = manifests.get("package.json").version;
const versionedManifests = [
  "plugins/openai/score-studio/.codex-plugin/plugin.json",
  "plugins/claude/score-studio/.claude-plugin/plugin.json",
  "plugins/gemini/score-studio/gemini-extension.json",
  "plugins/cursor/score-studio/.cursor-plugin/plugin.json",
];
for (const file of versionedManifests) {
  if (manifests.get(file).version !== releaseVersion) {
    throw new Error(`${file} version does not match package ${releaseVersion}`);
  }
}

const claudeMarketplace = manifests.get(".claude-plugin/marketplace.json");
if (claudeMarketplace.metadata.version !== releaseVersion || claudeMarketplace.plugins[0]?.version !== releaseVersion) {
  throw new Error("Claude marketplace version does not match package version");
}

const cursorMarketplace = manifests.get(".cursor-plugin/marketplace.json");
if (cursorMarketplace.metadata.version !== releaseVersion) {
  throw new Error("Cursor marketplace version does not match package version");
}
if (cursorMarketplace.plugins[0]?.source !== "./plugins/cursor/score-studio") {
  throw new Error("Cursor marketplace source is not the bundled Cursor plugin");
}

const cursorManifest = manifests.get("plugins/cursor/score-studio/.cursor-plugin/plugin.json");
if (!cursorManifest.variables?.required?.includes("SCORESTUDIO_TOKEN")) {
  throw new Error("Cursor plugin must require SCORESTUDIO_TOKEN as a configured variable");
}

const cursorMcp = manifests.get("plugins/cursor/score-studio/mcp.json");
if (cursorMcp.mcpServers?.["score-studio"]?.env?.SCORESTUDIO_TOKEN !== "${SCORESTUDIO_TOKEN}") {
  throw new Error("Cursor MCP token must remain a variable placeholder");
}

const hermesSkill = await readFile(resolve(root, "skills/score-studio/SKILL.md"), "utf8");
if (!hermesSkill.includes("required_environment_variables:\n  - name: SCORESTUDIO_TOKEN")) {
  throw new Error("Hermes skill must declare secure SCORESTUDIO_TOKEN setup");
}

await validatePublicReleaseHygiene(root);

console.log(`Validated ${jsonFiles.length} manifests and ${required.length} required files.`);

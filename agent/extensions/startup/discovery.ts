import { readdirSync, existsSync, statSync, readFileSync, type Dirent } from "node:fs";
import { join, resolve, relative, basename } from "node:path";
import { sep } from "node:path";
import { homedir as osHomedir } from "node:os";

const EXT_FILE_RE = /\.(ts|js)$/;

// Read a package's `pi` manifest from <pkgRoot>/package.json (the `pi` key).
// Mirrors pi's readPiManifestFile. Returns null when absent / unreadable.
function readPiManifest(pkgRoot: string): Record<string, unknown> | null {
  try {
    const pkg = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf-8"));
    const pi = pkg?.pi;
    return pi && typeof pi === "object" ? (pi as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function hasGlob(s: string): boolean {
  return /[*?]/.test(s);
}

// Convert a single path segment (no `/`) into a regex. `*` -> [^/]*, `?` -> [^/].
function segRegex(seg: string): RegExp {
  let r = "^";
  for (const c of seg) {
    if (c === "*") r += "[^/]*";
    else if (c === "?") r += "[^/]";
    else if ("\\^$.|()[]{}+".includes(c)) r += "\\" + c;
    else r += c;
  }
  return new RegExp(r + "$");
}

// Expand a glob pattern relative to `root`, returning absolute paths (files
// and dirs), mirroring pi's `globSync({ cwd: root, absolute: true, dot: false,
// nodir: false })`. Supports `*` (within a segment), `**` (zero+ segments), and
// `?`. `**` is only honoured as a full segment, matching pi/minimatch usage.
function expandGlob(pattern: string, root: string): string[] {
  const segs = pattern.replace(/^\.\//, "").split("/");
  const out: string[] = [];
  const walk = (dir: string, i: number): void => {
    if (i >= segs.length) {
      out.push(dir);
      return;
    }
    const seg = segs[i];
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    if (seg === "**") {
      walk(dir, i + 1); // match zero segments
      for (const e of entries) {
        if (e.isDirectory()) walk(join(dir, e.name), i); // keep `**` for recursion
      }
      return;
    }
    const re = segRegex(seg);
    for (const e of entries) {
      if (re.test(e.name)) walk(join(dir, e.name), i + 1);
    }
  };
  walk(root, 0);
  return out;
}

// minimatch-style matcher for `!`-override exclusion patterns. `*` -> [^/]*,
// `**` -> .*, `?` -> [^/]. Tested against a file's path relative to the package
// root and against its basename (pi's applyPatterns checks both).
function mmLike(str: string, pattern: string): boolean {
  let r = "^";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "*") {
      if (pattern[i + 1] === "*") {
        r += ".*";
        i++;
      } else r += "[^/]*";
    } else if (c === "?") r += "[^/]";
    else if ("\\^$.|()[]{}+".includes(c)) r += "\\" + c;
    else r += c;
  }
  return new RegExp(r + "$").test(str);
}

// pi's collectAutoExtensionEntries: if `dir` itself has explicit extension
// entries (package.json `pi.extensions` or index.ts/index.js) return those;
// otherwise scan the directory — flat .ts/.js files are extensions and
// subdirs are inspected via resolveExtensionEntries. Dotfiles and node_modules
// are skipped; symlinks are followed via statSync.
function smartDiscover(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const rootEntries = resolveExtensionEntries(dir);
  if (rootEntries) return rootEntries;
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const e of entries) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const full = join(dir, e.name);
    let isDir = e.isDirectory();
    let isFile = e.isFile();
    if (e.isSymbolicLink()) {
      try {
        const st = statSync(full);
        isDir = st.isDirectory();
        isFile = st.isFile();
      } catch {
        continue;
      }
    }
    if (isFile && EXT_FILE_RE.test(e.name)) out.push(full);
    else if (isDir) {
      const sub = resolveExtensionEntries(full);
      if (sub) out.push(...sub);
    }
  }
  return out;
}

// pi's resolveExtensionEntries: if <dir>/package.json has `pi.extensions`,
// resolve each entry with plain `resolve` (NO glob here — glob is only used at
// the package-root manifest level) and keep existing ones; else fall back to
// index.ts / index.js. Returns null when the dir has no extension entry.
function resolveExtensionEntries(dir: string): string[] | null {
  const pkgJson = join(dir, "package.json");
  if (existsSync(pkgJson)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgJson, "utf-8"));
      const exts = pkg?.pi?.extensions;
      if (Array.isArray(exts) && exts.length) {
        const resolved: string[] = [];
        for (const extPath of exts) {
          if (typeof extPath !== "string") continue;
          const p = resolve(dir, extPath);
          if (existsSync(p)) resolved.push(p);
        }
        if (resolved.length) return resolved;
      }
    } catch {}
  }
  if (existsSync(join(dir, "index.ts"))) return [join(dir, "index.ts")];
  if (existsSync(join(dir, "index.js"))) return [join(dir, "index.js")];
  return null;
}

// pi's addManifestEntries (package-root level): split sources from `!`
// overrides, expand globs / resolve plain paths, classify each result (file
// stays as-is, dir is smart-discovered), then drop files matched by an override.
function manifestExtensionFiles(entries: unknown[], root: string): string[] {
  const sources: string[] = [];
  const overrides: string[] = [];
  for (const e of entries) {
    if (typeof e !== "string") continue;
    if (e.startsWith("!")) overrides.push(e.slice(1).replace(/^\.\//, ""));
    else sources.push(e);
  }
  const files: string[] = [];
  for (const e of sources) {
    const paths = hasGlob(e) ? expandGlob(e, root) : [resolve(root, e)];
    for (const p of paths) {
      try {
        const st = statSync(p);
        if (st.isFile()) files.push(p);
        else if (st.isDirectory()) files.push(...smartDiscover(p));
      } catch {}
    }
  }
  if (!overrides.length) return files;
  return files.filter((f) => {
    const rel = relative(root, f).split(sep).join("/");
    const name = basename(f);
    return !overrides.some((pat) => mmLike(rel, pat) || mmLike(name, pat));
  });
}

// pi's matchesAnyPattern: test a file's relative path, basename, and
// absolute (posix) path against the given patterns (a leading `./` is stripped
// from each pattern for leniency — pi's minimatch doesn't, but well-formed
// package filters omit it anyway, so this only ever broadens the match).
function matchesAnyPattern(filePath: string, patterns: string[], baseDir: string): boolean {
  const rel = relative(baseDir, filePath).split(sep).join("/");
  const name = basename(filePath);
  const absPosix = filePath.split(sep).join("/");
  return patterns.some((raw) => {
    const pat = raw.replace(/^\.\//, "");
    return mmLike(rel, pat) || mmLike(name, pat) || mmLike(absPosix, pat);
  });
}

// pi's applyPatterns: split includes / `!`excludes / `+`force-includes /
// `-`force-excludes. No includes => start from all; else filter to includes.
// Drop excludes, re-add force-includes from the full set, then drop force-excludes.
function applyUserPatterns(files: string[], patterns: string[], root: string): string[] {
  const includes: string[] = [];
  const excludes: string[] = [];
  const forceIncludes: string[] = [];
  const forceExcludes: string[] = [];
  for (const p of patterns) {
    if (p.startsWith("+")) forceIncludes.push(p.slice(1));
    else if (p.startsWith("-")) forceExcludes.push(p.slice(1));
    else if (p.startsWith("!")) excludes.push(p.slice(1));
    else includes.push(p);
  }
  let result = includes.length === 0 ? [...files] : files.filter((f) => matchesAnyPattern(f, includes, root));
  if (excludes.length) result = result.filter((f) => !matchesAnyPattern(f, excludes, root));
  for (const f of files) {
    if (!result.includes(f) && matchesAnyPattern(f, forceIncludes, root)) result.push(f);
  }
  if (forceExcludes.length) result = result.filter((f) => !matchesAnyPattern(f, forceExcludes, root));
  return result;
}

// pi's extension loading for one package. Two paths:
//  - No `extensions` filter on the settings entry (string form, or object form
//    without an `extensions` key): collectPackageResources — a `pi` manifest
//    drives the count (glob-expanded, `!` overrides applied); a manifest without
//    an `extensions` key counts as 0 (no convention fallback); no manifest at
//    all falls back to the convention `extensions/` dir.
//  - `extensions` filter present (object form with an `extensions` array):
//    applyPackageFilter via collectManifestFiles — same manifest resolution,
//    but a manifest without an `extensions` key DOES fall back to the
//    convention dir, then the user patterns are applied on top (`[]` disables
//    all; `!`/`+`/`-` are excludes/force-includes/force-excludes).
function packageExtensionFiles(pkgRoot: string, userFilter?: string[] | null): string[] {
  const manifest = readPiManifest(pkgRoot);
  const entries = manifest?.extensions;
  const manifestHasEntries = Array.isArray(entries) && entries.length > 0;
  let allFiles: string[];
  if (manifestHasEntries) allFiles = manifestExtensionFiles(entries as unknown[], pkgRoot);
  else if (manifest && !userFilter) allFiles = [];
  else allFiles = smartDiscover(join(pkgRoot, "extensions"));
  if (!userFilter) return allFiles;
  if (userFilter.length === 0) return [];
  return applyUserPatterns(allFiles, userFilter, pkgRoot);
}

function countExtensions(homeDir: string, cwd: string): number {
  const seen = new Set<string>();

  // Local auto-discovered dirs (user + project scope). pi scans these via
  // collectAutoExtensionEntries → smartDiscover.
  const localDirs = [
    join(homeDir, ".pi", "agent", "extensions"),
    join(cwd, ".pi", "extensions"),
    join(cwd, "extensions"),
  ];
  for (const d of localDirs) for (const f of smartDiscover(d)) seen.add(f);

  // Packages from settings, per scope. Each settings file configures packages
  // for a specific scope; pi unpacks npm packages under that scope's
  // npm/node_modules dir (mirroring getManagedNpmInstallPath) and git packages
  // under that scope's git dir (mirroring getGitInstallPath =
  // join(gitRoot, host, path)). We then read each package's `pi.extensions`
  // manifest (or convention `extensions/` dir) to count individual extensions
  // inside the package rather than the package as one entry.
  const scopedSettings = [
    { settingsPath: join(homeDir, ".pi", "agent", "settings.json"), npmBase: join(homeDir, ".pi", "agent", "npm", "node_modules"), gitRoot: join(homeDir, ".pi", "agent", "git") },
    { settingsPath: join(cwd, ".pi", "settings.json"), npmBase: join(cwd, ".pi", "npm", "node_modules"), gitRoot: join(cwd, ".pi", "git") },
  ];
  for (const { settingsPath, npmBase, gitRoot } of scopedSettings) {
    if (!existsSync(settingsPath)) continue;
    let settings: any;
    try {
      settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
    } catch {
      continue;
    }
    for (const pkg of (settings?.packages ?? [])) {
      const isObj = typeof pkg === "object" && pkg !== null;
      const source = typeof pkg === "string" ? pkg : isObj ? pkg.source : undefined;
      if (typeof source !== "string") continue;
      const extFilter = isObj && Array.isArray(pkg.extensions) ? pkg.extensions : undefined;
      const trimmed = source.trim();
      let pkgRoot: string | null = null;
      if (trimmed.startsWith("npm:")) {
        const body = trimmed.slice(4);
        const vIdx = body.lastIndexOf("@");
        const name = vIdx > 0 ? body.slice(0, vIdx) : body;
        if (!name) continue;
        pkgRoot = join(npmBase, name);
      } else if (trimmed.startsWith("git:")) {
        const parsed = parseGitSource(trimmed);
        if (!parsed) continue;
        pkgRoot = join(gitRoot, parsed.host, parsed.path);
      } else continue;
      if (!pkgRoot || !existsSync(pkgRoot)) continue;
      for (const f of packageExtensionFiles(pkgRoot, extFilter)) seen.add(f);
    }
  }

  return seen.size;
}

export interface LoadedCounts {
  models: number;
  contextFiles: number;
  extensions: number;
  skills: number;
  promptTemplates: number;
  mcpServers: number;
}

function countContextFiles(homeDir: string, cwd: string): number {
  const paths = [
    join(homeDir, ".pi", "agent", "AGENTS.md"),
    join(homeDir, ".claude", "AGENTS.md"),
    join(cwd, "AGENTS.md"),
    join(cwd, "CLAUDE.md"),
    join(cwd, ".pi", "AGENTS.md"),
  ];
  return paths.filter(existsSync).length;
}

// Parse a `git:` source into the host/path segments pi uses for its on-disk
// install path (mirroring pi's getGitInstallPath = join(gitRoot, host, path)).
// The ref (@...) is not part of the install path; it is stripped form-aware
// (only within the path portion, mirroring pi's splitRef) so the scp `git@host:`
// userinfo isn't mistaken for a ref. Host and path keep their original case:
// pi does not normalise case for the scp / bare forms, so we must not either
// (the scheme branch inherits JS's `new URL().hostname` lowercasing, which pi
// also relies on). Handles the common scp / scheme / bare forms; returns null
// for anything unrecognised, so the caller skips it and exotic URLs simply
// aren't counted.
function parseGitSource(source: string): { host: string; path: string } | null {
  const url = source.slice("git:".length).trim();
  const norm = (p: string): string => p.replace(/\.git$/, "").replace(/^\/+/, "");
  const ok = (host: string, path: string): { host: string; path: string } | null =>
    host && path.split("/").length >= 2 ? { host, path } : null;

  // scp-like: git@host:path[@ref] — ref @ lives only in the path part.
  const scp = url.match(/^git@([^:]+):(.+)$/);
  if (scp) {
    const host = scp[1] ?? "";
    const pathWithRef = scp[2] ?? "";
    const refSep = pathWithRef.indexOf("@");
    const path = norm(refSep >= 0 ? pathWithRef.slice(0, refSep) : pathWithRef);
    return ok(host, path);
  }

  // scheme://[user@]host[:port]/path[@ref] — ref @ lives only in the path.
  if (url.includes("://")) {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname;
      const pathWithRef = parsed.pathname.replace(/^\/+/, "");
      const refSep = pathWithRef.indexOf("@");
      const path = norm(refSep >= 0 ? pathWithRef.slice(0, refSep) : pathWithRef);
      return ok(host, path);
    } catch {
      return null;
    }
  }

  // bare: host/path[@ref] — reject hosts without a dot (except localhost),
  // matching pi's parseGenericGitUrl guard.
  const slash = url.indexOf("/");
  if (slash > 0) {
    const host = url.slice(0, slash);
    if (!host.includes(".") && host !== "localhost") return null;
    const pathWithRef = url.slice(slash + 1);
    const refSep = pathWithRef.indexOf("@");
    const path = norm(refSep >= 0 ? pathWithRef.slice(0, refSep) : pathWithRef);
    return ok(host, path);
  }
  return null;
}

type CommandLike = ReadonlyArray<{ source: string; name: string }>;

// Count skills from pi's command registry so package-installed skills are
// included, not just those under ~/.pi/agent/skills.
function countSkills(commands: CommandLike): number {
  const seen = new Set<string>();
  for (const c of commands) {
    if (c.source === "skill") seen.add(c.name);
  }
  return seen.size;
}

// Count prompt templates from pi's command registry so package-installed
// prompts are included, not just those under ~/.pi/agent/prompts.
function countTemplates(commands: CommandLike): number {
  const seen = new Set<string>();
  for (const c of commands) {
    if (c.source === "prompt") seen.add(c.name);
  }
  return seen.size;
}

function countModels(homeDir: string, cwd: string): number {
  const seen = new Set<string>();
  const paths = [
    join(homeDir, ".pi", "agent", "settings.json"),
    join(cwd, ".pi", "settings.json"),
  ];
  for (const path of paths) {
    if (!existsSync(path)) continue;
    try {
      const settings = JSON.parse(readFileSync(path, "utf8"));
      const arr = settings?.enabledModels;
      if (Array.isArray(arr)) {
        for (const m of arr) if (typeof m === "string" && m.trim()) seen.add(m.trim());
      }
    } catch {}
  }
  return seen.size;
}

function countMcpServers(homeDir: string): number {
  const configPath = join(homeDir, ".pi", "agent", "configs", "mcp.json");
  if (!existsSync(configPath)) return 0;
  try {
    const cfg = JSON.parse(readFileSync(configPath, "utf-8"));
    if (cfg?.mcpServers && typeof cfg.mcpServers === "object") {
      return Object.keys(cfg.mcpServers).length;
    }
  } catch {}
  return 0;
}

export function discoverLoadedCounts(commands: CommandLike): LoadedCounts {
  const homeDir = osHomedir();
  const cwd = process.cwd();
  return {
    models: countModels(homeDir, cwd),
    contextFiles: countContextFiles(homeDir, cwd),
    extensions: countExtensions(homeDir, cwd),
    skills: countSkills(commands),
    promptTemplates: countTemplates(commands),
    mcpServers: countMcpServers(homeDir),
  };
}

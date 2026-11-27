// What runs by itself, or decides what does, as floor rule 8's proof that a change to it is only comments and steps'
// names reads it (comment-only.mjs, beside this file; floor rule 3): the files that proof reads (RUNS) and those it
// refuses outright (RUNS_TOO). power.mjs seeds what runs with power from RUNS_TOO, and security-review.mjs reads RUNS,
// so whoever changes what one of them counts as running by itself changes it here, for all three (#1341). Data alone.

export const RUNS = /(?:^|\/)(?:\.(?:github|claude)(?:\/|$)|action\.ya?ml$)/iu; // what runs by itself, as far as the proof reads it
// what else runs by itself or decides what does, refused outright: Claude Code's servers; another agent tool's own
// folder (Kiro's, Codex's, Antigravity's, Gemini's, Cursor's and the like: their hooks, settings and rules; core
// archive 232); an editor's, a container's or a shell's setup and git's hooks; npm's, pnpm's, yarn's and .NET's
// packages, tools, configs, hooks and builds (MSBuild runs a project's targets, and reads by itself a project's .user
// file and a folder's Directory.Build.rsp) and the Node or SDK they pick; a task runner's file; the copy of the core;
// git's own attributes and submodules; a container's build; and a name with "~" and a digit, which Windows can read as
// another folder's short name (CLAUDE~1 for .claude). It is asked first: a file of the copy of the core is refused even
// where it is one the proof reads.
export const RUNS_TOO = /(?:^|\/)(?:\.mcp\.json|package\.json|package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|\.yarnrc(?:\.yml)?|\.npmrc|\.node-version|\.node-least|\.nvmrc|\.envrc|\.devcontainer\.json|\.pre-commit-config\.ya?ml|\.gitmodules|\.gitattributes|(?:[^/]*\.)?(?:Dockerfile|Containerfile)[^/]*|Makefile|GNUmakefile|justfile|Taskfile\.ya?ml|\.tool-versions|\.?mise\.toml|nuget\.config|global\.json|dotnet-tools\.json|packages\.lock\.json|[^/]+\.(?:(?:cs|fs|vb)?proj(?:\.user)?|projitems|shproj|props|targets)|Directory\.Build\.rsp|\.pnpmfile\.cjs)$|(?:^|\/)\.(?:vscode|devcontainer|husky|yarn\/releases|kiro|codex|agents?|gemini|cursor|windsurf|amazonq|continue|roo)(?:\/|$)|^core\/|(?:^|\/)[^/]*~\d/iu;

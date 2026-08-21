# Antigravity Chinese Localization — Project Instructions

These instructions apply to every AI agent and contributor working in this repository. The goal is to deliver natural, complete, and maintainable Simplified Chinese localization without breaking Antigravity behavior, user content, technical identifiers, or renderer performance.

## 1. Current target and sources of truth

- The current localization target is **Antigravity v2.9.1**. The current version dictionary is `dicts/v2.9.1.json`; the version, date, support statement, and dictionary name documented in `README.md` must describe the same target.
- Treat the repository's actual files and executable behavior as authoritative. If this document, `README.md`, a dictionary filename, or an engine comment disagrees with the current client or implementation, report the mismatch and update only the files needed for the requested task.
- A version update must replace or deliberately migrate the previous version dictionary rather than leave multiple version dictionaries active by accident. The engine loads **every** `dicts/*.json` file, so retaining both old and new version files changes the effective dictionary. Before a version bump, compare against the official client source, audit collisions, update all current-version references, and do not change tags or release metadata unless explicitly requested.
- `README.md` is the user-facing description of supported platforms, installation, restoration, and current coverage. Keep technical claims there consistent with `install.sh`, `uninstall.sh`, the Windows batch launchers, and `localization_engine.js`; do not claim tooling, tests, paths, or compatibility that the repository does not provide.

## 2. Repository structure and ownership

- JSON files in `dicts/` are renderer-facing Simplified Chinese dictionaries. Before changing one, use `rg` across all dictionaries to find existing keys and translations. Reuse established wording and avoid duplicate, case-only, or conflicting entries.
- `localization_engine.js` has two responsibilities:
  1. build and inject the renderer translation engine, including dynamic text and React-fragment rules; and
  2. unpack/repack `app.asar` and patch packaged Electron surfaces such as `preload.js`, `menu.js`, `tray.js`, `loadingOverlay.js`, and updater-related files.
- Put fixed renderer text in the most appropriate `dicts/*.json` file. Fixed native menu, tray, loading, or updater text belongs in the corresponding narrowly scoped injection block in `localization_engine.js`, because those surfaces do not consume the renderer dictionary.
- `install.sh` and `双击安装中文汉化.bat` are the supported installation entry points. `uninstall.sh` and `双击卸载还原官方英文.bat` are the supported restoration entry points. `localization_engine.js` is side-effecting and is not a development test command.
- `.gitattributes` protects Windows batch files from Git text conversion. Treat the shipped `.bat` files as encoded release artifacts: do not reformat or rewrite them with ordinary UTF-8 tooling. When a batch-file change is explicitly requested, use the repository's `convert_to_gbk.ps1` workflow and verify the resulting encoding and line endings.
- Change only dictionaries, engine rules, installer scripts, documentation, or version references directly relevant to the requested outcome. Do not reorder large dictionaries, reformat unrelated files, add dependencies, or change release metadata speculatively.

## 3. Dictionary loading and matching semantics

- `loadDictionary()` reads all JSON dictionaries in lexicographic filename order. Keys are normalized by collapsing whitespace, trimming, and normalizing curly quotes. If two files contain the same normalized key, the later-loaded file silently overrides the earlier value.
- The renderer map also has a case-insensitive fallback. Therefore, keys that differ only by case are conflicts even when JSON itself accepts them. Audit normalized duplicates, case-insensitive duplicates, and source-equals-translation no-op entries before handoff.
- Invalid JSON is skipped by the loader rather than surfaced to the client. Parsing every dictionary independently is mandatory; never assume that a successful install proves every dictionary was loaded.
- Dictionary keys must match actual client source text after the engine's normalization. Do not add screenshot-specific counts, speculative variants, or broad single-word substitutions just to make a visible example translate.
- Exact dictionary matching is preferred for short labels and complete fixed sentences. The engine may use case-insensitive fallback and long-entry substring replacement for entries longer than 20 characters, so long keys still need enough context to be safe inside ordinary UI text.
- Fragment-only keys such as a suffix, article, or grammar connector are allowed only when the client is confirmed to render that exact fragment as an independent UI node and the key cannot affect unrelated content. Otherwise, handle the complete dynamic sentence in the engine.
- Preserve the `--brand-title` behavior: English keeps the official `Antigravity` brand, hidden removes its visual label, and translated permits the Chinese brand translation. Do not make a dictionary edit that bypasses those modes.

## 4. Translation quality and terminology

- Translate complete meaning in its real UI context rather than word by word. Keep buttons, menus, prompts, errors, and status text concise and natural, using standard Simplified Chinese punctuation.
- Use the following terminology consistently unless a specific UI context requires a documented exception:
  - `agent` → “智能体”
  - `conversation` / UI `chat` → “会话”
  - `project` → “项目”
  - `workspace` → “工作区”
  - `worktree` → “工作树”
  - `goal` → “目标”
  - `task` → “任务”
  - `file` → “文件”
  - `folder` → “文件夹”
  - `page` → “页面” or counted “个页面”
  - `search` → “搜索” or counted “次搜索”
  - `tool` → “工具”
- Keep project and workspace distinct; do not translate both to the same term merely because a screen visually groups them.
- Preserve content that must not be translated: URLs, paths, commands, code, keyboard shortcuts, model names, product names, MCP, API, environment variables, configuration keys, version numbers, and user-provided text. Translate only the surrounding explanation.
- Preserve placeholders and runtime values exactly. A translation must not drop, reorder ambiguously, or hard-code project names, file names, model names, email addresses, dates, counts, shortcuts, or status suffixes.

## 5. Dynamic text, React fragments, and screenshot reports

- For every screenshot report, identify the original English source text, UI location, expected Chinese output, and whether the content is fixed, variable, or split across DOM nodes. Do not infer a dictionary key solely from the final mixed Chinese/English rendering.
- Use capture groups for dynamic counts, durations, dates, model names, project names, and file names. Every count rule must support both singular and plural source forms and produce the correct Chinese classifier.
- Never add a dictionary key for only the number shown in a screenshot. For example, `Explored 1 page` and `Explored 2 pages` must be covered by one bounded rule that yields “探索了 1 个页面” and “探索了 2 个页面”.
- React can split one sentence into adjacent text nodes or temporarily render an incomplete intermediate state. When required, combine only the smallest relevant container, wait for a semantically complete source sentence, and update its text nodes without flattening child elements.
- A fragmented rule should cover the complete sentence and any independently rendered count or suffix fragment that is actually required. Preserve arrows, icons, links, emphasis, shortcuts, and button elements.
- Dynamic patterns must be anchored and context-specific. Ensure the resulting Chinese text cannot match the English source pattern and trigger repeated processing.
- Do not add third-party web content, user messages, terminal output, editor/code content, or generated model responses to a global dictionary, even when they appear untranslated in a screenshot.

## 6. Protected content and DOM safety

- Never translate user prompts, chat bodies, Monaco/code-editor content, terminal input or output, command arguments, file contents, URLs, secrets, or credentials.
- Respect all existing exclusion mechanisms, including `data-testid="user-input-step"`, `data-ag-localization-skip`, editor/terminal class guards, blocked tags, content-editable regions, and Shadow DOM ancestor traversal. A new combined-container rule must filter protected descendants and must not concatenate text across a protected boundary.
- Do not use broad `innerHTML` or `textContent` replacement on interactive containers. Preserve DOM structure, React-owned elements, event handlers, links, emphasis nodes, user data, selection state, and accessibility attributes.
- DOM translation must be idempotent. Before assigning `nodeValue` or an observed attribute, compare old and new values and skip identical writes. A same-value `CharacterData` write can still create a `MutationRecord` and recursively re-enter the observer.
- Keep `MutationObserver` work incremental. `startEngine()` must remain single-start/idempotent; do not add recurring full-document scans or delayed scan timers to compensate for missing rules.
- Avoid repeatedly scanning the same ancestors for every child text node. Use stable text/length prefilters before expensive container queries, and scope structural rules to the smallest plausible container.
- Do not add translation markers or observed-attribute writes to SVG/path/icon nodes. Only elements that can hold protected user text should receive browser-translation protection attributes.
- When modifying a structural or fragmented rule, test at least: already-translated input, a React re-render, a dynamic value update, multiple sibling items, and a protected descendant. No case may cause an observer loop, cross-item translation, or loss of click behavior.

## 7. Required implementation workflow

1. Inspect `git status` before editing and preserve unrelated user changes. Never overwrite, stage, or include them implicitly.
2. Read the relevant dictionary entries, engine functions, screenshots, current-version dictionary, and—when available—the official client source that produces the text. Confirm the English source and DOM composition before selecting an implementation.
3. Use an exact dictionary entry for fixed renderer text, the appropriate native injection block for fixed Electron menu/tray/loading/updater text, and the smallest safe regular expression or text-node rule for runtime content.
4. Search all dictionaries for normalized and case-insensitive collisions. Because filename order determines overrides, do not rely on an accidental later file to resolve conflicting translations.
5. Keep changes minimal and document non-obvious dynamic or structural behavior next to the rule. Comments must describe the current invariant rather than an obsolete client version.
6. For performance-sensitive engine changes, compare observer activity and DOM writes on representative project and settings containers. Translation completeness alone is not sufficient if opening a panel becomes slower or unresponsive.

## 8. Required verification

For dictionary or engine changes, perform all applicable checks before handoff:

1. Parse every `dicts/*.json` file independently.
2. Audit normalized duplicates, case-insensitive duplicates, and source-equals-translation entries.
3. Run `node --check localization_engine.js`.
4. Compile-check the output of `generateJs()` using a non-installing harness that prevents the final `main()` call from running. Do **not** execute `node localization_engine.js` to obtain the generated source.
5. When an official `preload.js` fixture or extracted source is already available, compile-check the official preload plus the generated injection as one script.
6. Run focused non-installing DOM regression tests for changed dynamic rules, including singular/plural, fragmented nodes, protected zones, repeat processing, and sibling isolation as applicable.
7. Run `git diff --check`, inspect the final diff, and confirm that no conflict markers or unintended files are present.

For documentation- or rule-only changes, runtime validation is not required. Perform a repository-reference/coherence review, run `git diff --check`, and report which executable claims were checked against current source.

## 9. Installation, destructive actions, and Git

- Do not run commands that install, inject, restore, or otherwise modify a user's Antigravity client during development. In particular, never run `node localization_engine.js`, `install.sh`, `uninstall.sh`, either Windows batch installer, or equivalent deployment commands.
- Do not delete `_temp_asar`, backups, application files, or user data unless the user explicitly requests the exact destructive action and the target has been verified.
- After source changes, instruct the user to install manually: Linux normally uses `sudo ./install.sh`; Windows uses `双击安装中文汉化.bat` as administrator. Restoration uses the corresponding uninstall entry point.
- Update versions, create tags, commit, push, publish a GitHub Release, or stage files only when explicitly requested. Before staging, verify the exact file list and exclude unrelated user changes.

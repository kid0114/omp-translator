# omp-translator
[繁體中文](README.zh-TW.md)

Live translation for [omp](https://github.com/can1357/oh-my-pi): your input is translated into the **output language** (the language the main model thinks and replies in), and the model's replies are displayed in your **input language** (your reading language). Session history keeps the original text; translations are display-only and never touch what the model sees.

- Automatic source-language detection — type in any language
- Bidirectional: both input→output and reply→display translation, each toggleable independently (`/translator input` translates only input)
- Display translation: while a reply is being generated you see a localized "translating…" placeholder; after the reply finishes, validated translations replace its prose. This is not token-by-token translation streaming.
- Markdown syntax, code, link targets, and recognized technical literals stay intact locally
- Translation runs on a separate, user-selected model; the main model choice is never changed
- Fails closed on input: a failed translation is never sent — your draft is restored to the editor
- Display translations live in memory only; already-printed terminal scrollback is not repainted

The Pi sibling is [pi-translator-live](https://github.com/kid0114/pi-translator-live).

## Install

```bash
omp plugin install github:kid0114/omp-translator
```

Then start a new omp process. Package installation installs the mdast/GFM parser dependencies automatically; no separate parser setup is needed. Saved preferences live in `~/.omp/agent/translator.json`.

Local development (symlink, live edits):

```bash
git clone https://github.com/kid0114/omp-translator.git
cd omp-translator
omp plugin link .
```

Pin a release instead of tracking the default branch:

```bash
omp plugin install github:kid0114/omp-translator#v1.0.0
```

Update / remove:

```bash
omp plugin upgrade omp-translator
omp plugin uninstall omp-translator
```

After install or upgrade, start a new omp session so the extension module loads.

## Requirements

- omp with plugin support (`omp plugin install github:…`)
- At least one allowed translator model in your omp registry: Gemini, Muse, or a `local-hymt2` provider. Cheap, fast models (e.g. Gemini Flash-class) make the best translators.

## First run

Translation starts enabled. If `translator.json` already names a still-available model, that model is used. Otherwise the plugin picks a `local-hymt2` model when one is registered, else a Gemini/Muse model. Save a choice with `/translator default`.

## Usage

Translation starts enabled. Commands:

| Command | Effect |
|---|---|
| `/translator` or `/translator both` | Enable input + reply translation |
| `/translator input` | Translate input only; replies stay in the output language |
| `/translator off` | Disable; pending translations are cancelled |
| `/translator original` | Read the last completed reply's original text (read-only viewer) |
| `/translator model [query]` | Switch translator model for this run (picker when omitted) |
| `/translator default [query]` | Same, but saved as the default |
| `/translator default clear` | Clear the saved default model |
| `/translator default input [lang]` | Set the **display language** for replies (e.g. `zh-TW`) |
| `/translator default output [lang]` | Set the **main-model language** (e.g. `en`) |

> Naming note: `default input` selects the language replies are **displayed** in; `default output` selects the language your input is translated **into** and the main model replies in.

Language arguments accept codes (`en`, `zh-CN`, `zh-TW`, `ja`, …) or English names; omit the argument to open a picker. 33 languages are built in.

While an input translation is running, press Esc to cancel it.

## Supported languages

All 33 built-in languages can be used as the input (display) language or the output (main-model) language in any combination — the source language is auto-detected by the translator model.

| Code | Language | Code | Language |
|---|---|---|---|
| `en` | English | `ru` | Russian |
| `zh-CN` | Simplified Chinese | `ar` | Arabic |
| `zh-TW` | Traditional Chinese | `hi` | Hindi |
| `ja` | Japanese | `th` | Thai |
| `ko` | Korean | `vi` | Vietnamese |
| `fr` | French | `id` | Indonesian |
| `de` | German | `ms` | Malay |
| `es` | Spanish | `tl` | Filipino |
| `pt` | Portuguese | `tr` | Turkish |
| `it` | Italian | `pl` | Polish |
| `cs` | Czech | `nl` | Dutch |
| `km` | Khmer | `my` | Burmese |
| `fa` | Persian | `gu` | Gujarati |
| `ur` | Urdu | `te` | Telugu |
| `mr` | Marathi | `bn` | Bengali |
| `ta` | Tamil | `jv` | Javanese |
| `he` | Hebrew | | |

Set with `/translator default input <code>` (display) and `/translator default output <code>` (model); English names (`japanese`, …) also work, and omitting the argument opens a picker.

Note: right-to-left languages (`ar`, `he`, `fa`, `ur`) are passed to the terminal as-is; display quality depends on your terminal's bidi support (iTerm2 with bidi enabled, WezTerm, and Windows Terminal handle it well).

## Choosing a translator model

### Local models (recommended when available)

A local Hy-MT2 server keeps your text on the machine (macOS Apple Silicon). Target hardware is MacBook Pro, including chips above Pro level (Max / Ultra). Speed on other chips is unknown. The launcher reads `sysctl hw.memsize` and only offers checkpoints that fit:

- **7B 8-bit** (best): **32 GiB+**, MLX reserve **10 GiB**
- **7B 4-bit**: **16 GiB+**, reserve **6 GiB**
- **1.8B** (8-bit then 4-bit): **8 GiB+**, reserve **2 GiB**

If `HYMT2_MODEL` is unset, it picks the best checkpoint that fits, preferring a Hugging Face cache hit. Below 32 GiB it will not start 7B 8-bit.


```bash
python3 -m pip install mlx-lm
scripts/start-hymt2 --check
scripts/start-hymt2
```

Loopback only. Default listen port is mlx_lm's 8080 (`HYMT2_PORT` overrides). Pipeline sharding is opt-in: `HYMT2_PIPELINE=1 scripts/start-hymt2`.

Merge `examples/models.yml` into `~/.omp/agent/models.yml`, then `/translator default local-hymt2/mlx-community/Hy-MT2-7B-8bit` (or the 4-bit / 1.8B id the launcher selected).

### Hosted models

Use a Gemini or Muse model you have already authenticated in omp — no extra setup is needed, it already appears in `/translator model`. Prefer cheap, fast, non-reasoning models: translation runs on every input and every reply, so a heavyweight reasoning model only adds latency and token cost.

## How it works

- **Input direction (fail-closed):** your prose is translated to the output language before dispatch. If translation fails, nothing is sent. The current request restores its original draft only when the editor is empty; a newer draft or session is never overwritten. Commands, `!shell`, paths, and code are never translated.
- **Display direction (atomic fallback):** replies show a "translating…" placeholder while generating. Once finalized, the complete reply is translated and validated before a Markdown display transform publishes it. History and what the main model receives are untouched. Failure shows the complete original reply, including original table cells, with one categorized status outside the reply—not failure text or counts inside paragraphs or cells.
- A system-prompt hook asks the main model to write its replies in the output language, preserving your task, code, paths, and tool arguments.
- **Parse-first prose units:** `mdast-util-from-markdown` with GFM parses the source before any model call. Only translatable text spans become units; identical units within a translation job share a request, and unique units are translated sequentially. Code/literal-only content needs no model request. There is no model-carried XML wrapper, marker-copying protocol, or selective fragment-retry protocol.
- **Locally preserved source:** original Markdown delimiters, block order, table layout, line endings, code, link destinations/reference IDs, and recognized commands, paths, URLs, and other technical literals stay on the client. Explicit link labels can be translated without changing their destinations. Literals remain in their original positions rather than being reordered by the model.
- **Reconstruction and validation:** translated prose is escaped as text and spliced into its original source spans. The final document is parsed again; its Markdown structure and protected literal values must match the original before the whole input/reply is accepted. Missing prose, introduced technical literals, or structural changes reject the complete result. Character references may appear beside emphasis delimiters in the raw reconstructed Markdown; they render as ordinary characters without extra visible spacing.
- Ordinary single-slash compounds, including mixed-script prose such as `類型/reputation`, are treated as prose when there is no clear path evidence. This deliberately favors translation for ambiguous bare compounds; put an ambiguous path or technical token in inline code to preserve it explicitly.
- Each request owns its cancellation and **60-second output-idle timer**. The timer starts only after the first nonempty text, thinking, or tool-call delta; empty heartbeats do not reset it. Queue/prefill waiting has no extension deadline, but provider transport and retry limits still apply.
- Mode, session, model, or language changes cancel stale work and prevent stale cache updates. A newer interactive input supersedes an older pending input.
- Requests are serialized through a single-flight queue with input priority. Cross-session fair scheduling and asynchronous sharding remain **not implemented**.

## Verification

```bash
bun test extensions/translator/translator-core.test.ts
```

The core regression suite covers source-span restoration, GFM tables/tasks, nested Markdown, Unicode offsets, code and technical literals, link targets, slash compounds, emphasis boundaries, escaped model punctuation, and atomic rejection of missing or unsafe prose. Parser dependencies are installed by the package manager.

## Troubleshooting

Failures are written to omp logs under `~/.omp/logs/` with direction, target language, selected model, elapsed time, category, and cause. Original documents and translations are not logged by the extension.

After editing extension files or updating the package, start a new omp process to load the changed modules. Switching translator models or toggling translation does not reload extension source.

- `idle-timeout`: output started, then stopped progressing for 60 seconds.
- `provider-timeout` or `provider`: the provider/transport failed; queue waiting alone is not an extension timeout.
- `completion`, `language`, or `protection`: incomplete output, untranslated prose, unsafe prose, or a reconstruction/Markdown structure violation. The complete original reply remains visible; partial translations are never published.
- Input failure: nothing is sent; the original draft is restored only if doing so will not replace newer editor contents.
- `/translator original` opens the latest completed reply's original text without changing history.

## Privacy

Your input and the model's replies are sent to the translator model you selected. Choose a local endpoint if that matters to you. No data is sent anywhere else; the extension stores only your preferences (`translator.json`) inside your own omp agent directory.

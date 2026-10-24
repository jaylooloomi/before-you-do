<h1 align="center">before-you-do</h1>

<p align="center">
  <b>One more instruction, before AI gets to work.</b><br>
  Hold <code>Alt + H</code>, choose a snippet, release to paste. Describe the task, then add how you want AI to approach it.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.2.0-informational" alt="Version 0.2.0">
  <img src="https://img.shields.io/badge/Tauri-2-24c8db" alt="Tauri 2">
  <img src="https://img.shields.io/badge/Windows-tested-22863a" alt="Windows tested on hardware">
  <img src="https://img.shields.io/badge/macOS-awaiting_hardware_testing-orange" alt="macOS awaiting hardware testing">
  <img src="https://img.shields.io/badge/data-local_storage-555" alt="Local storage">
  <img src="https://img.shields.io/badge/languages-zh--TW%20%7C%20zh--CN%20%7C%20EN%20%7C%20JA-5865f2" alt="Interface languages: Traditional Chinese, Simplified Chinese, English and Japanese">
  <a href="https://github.com/jaylooloomi/before-you-do/actions/workflows/build.yml"><img src="https://github.com/jaylooloomi/before-you-do/actions/workflows/build.yml/badge.svg" alt="Desktop builds status"></a>
  <a href="README.zh-TW.md"><img src="https://img.shields.io/badge/lang-繁體中文-green" alt="Read in Traditional Chinese"></a>
</p>

<p align="center">
  English · <a href="README.zh-TW.md">繁體中文</a>
</p>

<p align="center">
  <a href="#use-cases">Use cases</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#installation">Installation</a> ·
  <a href="#keyboard-controls">Keyboard controls</a> ·
  <a href="#faq">FAQ</a>
</p>

<p align="center"><img src="docs/images/before-you-do-hero-v2-lowercase.png" alt="before-you-do: replace repeated typing and searching through notes with Alt+H to paste instructions into an unsent AI message" width="1000"></p>

<p align="center"><sub>Promotional illustration. Alt+H is the configurable default shortcut. The app pastes text without sending your message.</sub></p>

Save the instructions you keep repeating to AI — “plan first,” “change only what is necessary,” or “test it before reporting back” — and insert them after writing your request. No API key, AI account or AutoHotkey required, and no dependency on a particular model.

**It pastes; you send.** You choose when to add an instruction and which one to use, and can edit it before sending. Prompts express your expectations; they do not guarantee that AI will follow them.

## Use cases

Six built-in templates cover common ways of working with AI. Each includes a usage scenario, and you can rewrite it in your own voice.

| Your situation | Choose this template | What you want AI to do |
|---|---|---|
| Your request is a little vague and you want it to explain its understanding first | **Understand, then proceed** | Briefly restate the requirements, purpose and constraints, then plan and proceed |
| You are discussing options and do not want code changes yet | **Plan before implementing** | Recommend an approach with reasons, stopping at the planning stage |
| The requirements are settled and you want implementation and verification | **Implement, test and report** | Implement, test the main flows, fix bugs, retest, and report results and anything unverified |
| AI has listed several options and you want it to make the call | **Choose and carry out a recommendation** | Choose a suitable approach, explain why, and carry it out |
| You need a small fix without an unrelated overhaul | **Change only what is necessary** | Preserve working behavior and avoid extra refactoring or scope expansion |
| AI says it is finished and you want evidence that it works | **Show it working** | Exercise the main flows, taking and inspecting screenshots where appearance matters |

For example, when you only want to discuss the approach, add:

> Do you understand what I mean? Plan it out and give me your recommended approach and reasons. Do not implement it yet.

Once you are ready to proceed, choose “Implement, test and report” instead. **The same task can need a different instruction depending on how far you want AI to take it.**

You can also add your own snippets, such as “Use Traditional Chinese and lead with the conclusion” or “Explain the tradeoffs before recommending an approach.” It works with web and desktop text fields that accept ordinary paste; compatibility varies by application.

## Quick start

Suppose you want to add language support:

1. Write your request in the AI chat box, insert a newline, and leave the cursor where you want the extra instruction.
2. **Hold Alt, then press H** to open your snippets.
3. Keep holding Alt and use **↑ / ↓** to select “Implement, test and report.”
4. **Release Alt** to paste the snippet into the original input field.
5. Review the text and send the message yourself.

```text
You write:
Add language support.

Alt + H → choose “Implement, test and report” → release Alt

Your chat box now contains:
Add language support.
Plan and implement this, then test the main user flows. Fix any bugs and retest.
When finished, report what you tested, the results, and anything still unverified.
Do not wait for my confirmation at every step.
```

<p align="center"><img src="docs/images/picker-settings.png" alt="Actual shortcut picker with snippets and fixed Add a prompt and Settings rows; Traditional Chinese interface shown" width="580"></p>

The picker preserves focus in the original input field. The screenshot shows the Traditional Chinese interface; the app supports four interface languages. You review and send the pasted message yourself.

## Installation

### Windows

Download the **Windows x64 portable ZIP** from [Releases](https://github.com/jaylooloomi/before-you-do/releases/latest). macOS Apple Silicon and Intel archives are also available, but have not been tested on real Mac hardware. These builds are unsigned.

The source repository does not include executables. Check successful [GitHub Actions builds](https://github.com/jaylooloomi/before-you-do/actions) for available build artifacts, or build the app yourself using the instructions below.

After obtaining a Windows build:

1. Extract its files into the same folder. If `WebView2Loader.dll` is included, keep it beside the executable.
2. Make sure Microsoft Edge WebView2 Runtime is installed.
3. Fully quit older versions or any AHK script using Alt+H, then launch the new version.
4. Save your snippets and try Alt+H in an AI chat box.

The Windows executable is `before-you-do.exe`. Automatic updates are not currently available.

Closing the manager window hides the app; the shortcut remains available. To exit completely, choose “Quit before-you-do” from the system tray menu.

### macOS and other platforms

Native Option+H and paste handling, plus Apple Silicon and Intel build configurations, are included. **macOS still needs testing on real hardware**, and signing and notarization are not provided. Allow Accessibility access and, if required, Input Monitoring. A Windows exe does not run on macOS.

Linux, phones, tablets and browser extensions are not currently supported.

## Keyboard controls

The table uses the default **Alt+H**. Change it under **Settings & AI guide → Keyboard shortcut**. The picker updates its hints; pressing your newly configured key a second time cancels it.

| Key | Action |
|---|---|
| **Hold Alt, then press H** | Open the picker; keep holding Alt |
| **↑ / ↓** | Select a snippet; wrap around the list, including the Add and Settings rows |
| **Release Alt** | Paste the selected snippet, create a draft if Add is selected, or open settings if Settings is selected |
| **Press H again while the picker is open** | Cancel and close; releasing Alt afterward does not paste |
| **Esc** | Cancel and close |
| **Ctrl + S** | Save all snippets in the manager |
| **/** | Search in the manager, unless you are editing text |

- Put your most-used snippet first: **a quick press and release of Alt+H pastes the first snippet**.
- The picker uses keyboard navigation rather than mouse selection to preserve the original input position.
- Holding H does not accidentally close it through key repeat; cancellation requires a fresh keypress.
- On macOS, use **Option ⌥ + H** and **Command + S**. These still await testing on Mac hardware.

## Make the instructions your own

The bottom of the Alt+H picker contains “Add a prompt” followed by “Settings.” Select Settings and release the shortcut modifiers to open **Settings & AI guide**, without pasting text or creating a draft.

### Customize the shortcut

The default is **Alt+H**. In **Settings & AI guide → Keyboard shortcut**, choose Alt / Option or Ctrl, optionally add Shift, and select A–Z, 0–9 or Space. Click **Save shortcut** to apply it immediately and keep it across restarts. You can also reset it to Alt+H.

For example, with **Ctrl+Shift+J**, hold Ctrl+Shift and press J, select with ↑ / ↓, then release the modifiers to paste. Press J again while the picker is open to cancel. On Windows, if the new combination is already registered, the app retains your previous shortcut and settings. On macOS, avoid combinations used by other apps. Common Ctrl editing combinations, such as copy, paste and save, cannot be assigned.

### Add, edit and reorder

Click “Add snippet” in the manager, enter a name and content, then click “Save snippets.” Or select “Add a prompt” at the bottom of the Alt+H picker and release Alt to create a draft.

Search the sidebar, drag snippets to reorder them, or use their ↑ / ↓ buttons. **Once saved, the next Alt+H picker uses the updated content and order.** Unsaved edits do not change the picker.

The list supports 1–100 snippets, with up to 100 characters per name and 20,000 per content field. Untouched default empty drafts are skipped when saving and remain in the current editor; other incomplete entries must be completed. Save any edits you want to keep before quitting.

### Four interface and template languages

In Settings & AI guide, choose **繁體中文, 简体中文, English, 日本語**, or follow the system language. Switching updates the manager and picker immediately and remembers your choice. Unsupported system languages fall back to English.

**Changing the interface language does not translate your snippets.** The template library separately offers four language versions. Preview the text and usage scenario, then choose “Add this template” to append a draft without replacing your existing list.

### Use your own AI to edit snippets

Settings & AI guide provides two workflows without connecting the app to an AI service:

- **Chat-based AI:** Copy the instructions and saved snippets, ask your AI to edit them, then paste the complete JSON back into settings. The app validates it and, after your confirmation, applies it and backs up the previous file.
- **AI with local file access:** Copy the editing instructions containing the actual file path. Have your AI back up and edit the file, then click “Reload file” in the app so stale editor content does not overwrite the updated file.

Importing and reloading replace the current list and unsaved drafts. Preserve any edits you need first. An ordinary web chat cannot read or write local files just because you give it a path.

## Why this exists

Every new conversation often repeats the same working preferences: “explain your understanding first,” “plan without implementing,” or “tell me what you tested.” Retyping takes time, and switching to a notes app interrupts your train of thought.

before-you-do keeps those instructions close at hand. Your task changes, but your preferred way of working can be reused across models and websites without installing an extension for each one.

The name echoes a family member calling out before you leave: “Wait — one more thing.”

## How it works

```text
Write your request
      ↓
Hold Alt + H → use ↑ ↓ to choose an instruction
      ↓
Release Alt → paste at the original cursor position
      ↓
Review the text and send it yourself
```

The app remembers the target and displays a picker without taking focus. After you release Alt, it inserts text using the system clipboard and paste operation. If the target changes, it cancels the paste. Choosing Add opens a draft; choosing Settings opens the settings page. Neither pastes text.

This is a local text tool. It does not read your AI conversations to select an instruction or send requests to a model.

## Compatibility and limitations

| Environment | Status |
|---|---|
| Windows | Selection, paste, cancellation and adding snippets tested on hardware |
| macOS — Apple Silicon / Intel | Native code and CI build configurations included; hardware testing pending |
| Linux, phones and tablets | Not supported yet |
| AI web and desktop input fields | Usable where ordinary text paste is accepted; not every application has been tested |

The default shortcut is Alt+H / Option+H and can be changed in settings. Cloud sync, rich text and automatic updates are not currently available.

## Where your data lives

Snippets are stored in a local JSON file. The app has no built-in cloud sync and does not send your snippets to AI on its own. You choose which service to paste them into; that service's data handling applies once you send the text there.

| Platform | Snippet file |
|---|---|
| Windows | `%APPDATA%\dev.quicksay.desktop\snippets.json` |
| macOS | `~/Library/Application Support/dev.quicksay.desktop/snippets.json` |

Shortcut settings are stored separately in `shortcut.json` in the same folder. Settings & AI guide shows the actual paths and lets you open the folder. Saving retains the previous version as `snippets.json.bak`; this is not a full version history. Before manually restoring it, quit the app, keep a separate copy of the current file, then copy the backup to `snippets.json`.

The app was previously named QuickSay. Its `dev.quicksay.desktop` identifier, data paths and preferences remain unchanged to preserve existing data. Legacy WPF XML compatibility still reads `%APPDATA%\QuickSay\settings.xml`.

**Pasting overwrites the system clipboard; its previous contents are not automatically restored.** Snippet files and clipboard contents are not encrypted. Clipboard history and sync tools may also retain them.

## FAQ

**Do I need an AI subscription, API key or AutoHotkey?**

No. The app saves and pastes text you prepare. It does not call AI models or depend on AHK.

**Does it automatically add instructions to every conversation?**

No. You choose when to open the picker, which snippet to use and when to send. You can edit the text after pasting.

**What if Alt+H does nothing?**

Check the shortcut status in the manager, quit older versions or apps using the same combination, then choose “Enable shortcut again.” On macOS, also check Accessibility and Input Monitoring permissions. You can choose another shortcut in settings if the current one conflicts with another app.

**Why was nothing pasted?**

Make sure the cursor is in a field that accepts paste and both Alt and H have been released. Switching away from the original target cancels the operation. On Windows, an app running as administrator may reject paste input from a normally privileged app.

**Why is my new snippet missing from the picker?**

New entries are drafts. Fill in the name and content and save them before opening Alt+H again.

## Development and builds

Built with Tauri 2, Rust, HTML, CSS and JavaScript. Production builds embed the frontend resources in the desktop app.

Requirements: Node.js 22.12+ or 24+, Rust stable, MSVC C++ Build Tools, Windows SDK and WebView2 on Windows, or Xcode Command Line Tools on macOS. See the official [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

```sh
git clone https://github.com/jaylooloomi/before-you-do.git
cd before-you-do
npm ci
npm run dev
```

Test and build:

```sh
npm test
npm run build:ui
cargo test --manifest-path src-tauri/Cargo.toml --locked
npm run build
```

The Windows executable is at `src-tauri/target/release/before-you-do.exe`; the macOS app is at `src-tauri/target/release/bundle/macos/before-you-do.app`. Use `npm run build -- --no-bundle` to build only the executable, or `--bundles app` on macOS.

<details>
<summary><b>Source guide and desktop integration tests</b></summary>

| Path | Contents |
|---|---|
| `src/main.js`, `src/style.css` | Manager interface and shortcut picker |
| `src/templates.json`, `src/template-locales.js` | Built-in templates, usage scenarios and four language versions |
| `src/locales.js`, `src/i18n.js` | Interface translations and language switching |
| `src/settings.js`, `src/ai-prompts.js` | Settings, AI instructions and import workflows |
| `src-tauri/src/` | Native shortcuts, paste, storage and window handling |
| `tests/`, `scripts/` | Tests and build tools |

GitHub Actions includes Windows and two Mac build jobs. A successful build does not verify real shortcut, focus and paste behavior on every platform. `scripts/test-windows.ps1` provides Windows desktop integration tests; it operates system keys and the clipboard, so run it during a dedicated testing session.

</details>

## Template sources and licensing

“Choose and carry out a recommendation” and “Change only what is necessary” draw on the [Get Shit Done execution workflow](https://github.com/gsd-build/get-shit-done/blob/main/get-shit-done/workflows/execute-plan.md). “Show it working” draws on the [Superpowers verification principles](https://github.com/obra/superpowers/blob/main/skills/verification-before-completion/SKILL.md). These are adaptations with translated versions, not verbatim text from the original authors.

The project currently has no `LICENSE` file. Contact the author about redistribution or other licensing needs.

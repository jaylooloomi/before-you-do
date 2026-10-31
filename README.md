<p align="center"><img src="src/assets/app-icon.png" alt="before-you-do" width="96" height="96"></p>

<h1 align="center">before-you-do</h1>

<p align="center">
  <b>One more instruction, before AI gets to work.</b><br>
  Add a reusable instruction, or gather this task’s text, images and files in one place.
</p>

<p align="center">
  <img src="https://img.shields.io/github/v/release/jaylooloomi/before-you-do" alt="Latest release">
  <img src="https://img.shields.io/badge/Tauri-2-24c8db" alt="Tauri 2">
  <img src="https://img.shields.io/badge/Windows-tested-22863a" alt="Windows tested on hardware">
  <img src="https://img.shields.io/badge/macOS-awaiting_hardware_testing-orange" alt="macOS awaiting hardware testing">
  <img src="https://img.shields.io/badge/data-local_storage-555" alt="Local storage">
  <img src="https://img.shields.io/badge/languages-zh--TW%20%7C%20zh--CN%20%7C%20EN%20%7C%20JA-5865f2" alt="Interface languages: Traditional Chinese, Simplified Chinese, English and Japanese">
  <a href="https://github.com/jaylooloomi/before-you-do/actions/workflows/build.yml"><img src="https://github.com/jaylooloomi/before-you-do/actions/workflows/build.yml/badge.svg" alt="Desktop builds status"></a>
  <a href="README.zh-TW.md"><img src="https://img.shields.io/badge/lang-繁體中文-green" alt="Read in Traditional Chinese"></a>
</p>

<p align="center">English · <a href="README.zh-TW.md">繁體中文</a></p>

<p align="center"><img src="docs/images/before-you-do-bundle-hero-en.png" alt="Octopus organizing reusable instructions and this task’s text, screenshots, video and files" width="1000"></p>

Tired of retyping “plan first” and “test your changes,” or pasting screenshots one by one? before-you-do reduces repeated typing and context gathering so you can hand AI a clearer request.

## 1. Add an instruction

Save the reminders you use repeatedly, then add the right one to your conversation:

> “Summarize your understanding, then proceed.”<br>
> “Only change what is necessary. Avoid unrelated refactoring.”<br>
> “Test the main flows and report the results.”

1. Write your request in the AI chat and leave the cursor where you want the instruction.
2. **Hold Alt, then press H.** Use **Left/Right** for roles and **Up/Down** for snippets.
3. **Release Alt to paste.** Review the message and send it yourself.

<p align="center"><img src="docs/images/current/picker-personal-en.png" alt="Alt+H snippet picker: choose an instruction and release Alt to paste" width="580"></p>

Customize snippets, usage scenarios, their order and the shortcut.

## 2. Gather this task into a bundle

For example, a login bug needs two screenshots, a short recording and a written description:

1. Open **Materials** and add text, images and files. You can also capture screenshots or recordings.
2. Drag items into order and refer to them as **#01, #02…** in your request.
3. **Export material bundle** and share the task text and attachments with your AI.

<p align="center"><img src="docs/images/current/materials-en.png" alt="Numbered task text, screenshot, video and file cards with preview and local bundle export" width="1000"></p>

The export contains <code>prompt.md</code>, attachment copies and <code>manifest.json</code>. **Copy combined text** copies text and attachment references instead.

**You currently attach exported files yourself.** Continuous clipboard collection and pasting all images/files into an Agent in one action are not available yet. The app never sends your message automatically.

## Download and get started

**[Download the latest release](https://github.com/jaylooloomi/before-you-do/releases/latest)** — Windows x64, Mac Apple Silicon and Mac Intel.

- **Windows:** extract the entire ZIP, keep its DLLs beside <code>before-you-do.exe</code>, then launch it. WebView2 Runtime is required.
- **Mac:** builds are available but still await hardware testing and are unsigned/unnotarized. Screenshots require macOS 14+ and screen capture permission. Recording is currently Windows-only.
- **Upgrading:** save drafts in every role, fully quit the old app from the tray, then replace it. Keep your existing data folder. Automatic updates are not available.

Data stays local and no API key is needed. You choose the AI, review the content and send it yourself.

**v0.6.0:** keep separate [named task packs](docs/task-packs.md) and [annotate or redact images](docs/image-editor.md). Back up your materials before upgrading: the new task-pack format cannot be opened by older versions.

## Keyboard essentials

| Action | Shortcut |
|---|---|
| Open the picker, then paste | Hold Alt and press H; release Alt |
| Switch roles / select snippets | Left/Right and Up/Down |
| Cancel | Esc, or press H again |
| Save the current role’s snippets | Ctrl+S |

Change the shortcut in **Settings**. On Mac, use Option and Command+S.

The [user guide](docs/USER_GUIDE.md) covers role templates, capture and recording, shortcut settings, AI-assisted snippet editing, backups and development. Screenshots use the current source and demo data; release differences and platform limits are noted in the guide.

[MIT License](LICENSE) · [Template sources and licensing](docs/USER_GUIDE.md#template-sources-and-licensing)

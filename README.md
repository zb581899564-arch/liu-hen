# liu-hen

`liu-hen` is a WeChat-style AI companion app that turns distilled chat history into a persistent digital persona.

It supports profile import, long-term relationship memory, proactive private chat, sticker interaction, moments feed, and Android APK packaging. The project is built around a lightweight web app plus an Android WebView shell, with direct model API integration and local-first profile/runtime management.

Large `.exprofile.zip` archives are intentionally kept local and are not tracked in Git. If you build your own local profile bundles, place them under `profiles/`, `exes/`, or `android/app/src/main/assets/profiles/` as needed, but keep the repository source-of-truth in the unpacked folders.

## Features

- Import distilled profiles and load them as persistent contacts
- Chat in a familiar WeChat-like interface
- Preserve relationship memory and conversation continuity
- Support proactive messages, stickers, and moments interactions
- Package the experience as an Android app
- Support importing zip packages distilled with `perkfly/ex-skill`

## Project Structure

- `app/`: web app UI and runtime logic
- `android/`: Android shell and packaging
- `profiles/`: built-in and imported profile bundles
- Local packaged profile archives are optional and ignored by Git
- `tests/`: automated tests

## Profile Import

This app accepts profile `.zip` packages.

- App-native `exprofile` bundles must include: `meta.json`, `persona.md`, `relationship_context.md`, `response_patterns.md`, `memories.md`, `sticker_profile.json`, `sticker_library.json`
- Original `perkfly/ex-skill` bundles are also supported and should include: `meta.json`, `SKILL.md`, `persona.md`, `memories.md`
- Distillation is designed to work well with the open-source project [perkfly/ex-skill](https://github.com/perkfly/ex-skill)

See [profile-import-format.md](</<workspace>/前任skill/docs/profile-import-format.md>) for the full import format guide.

## Status

This repository is under active development.

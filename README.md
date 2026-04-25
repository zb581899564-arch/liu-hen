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

## Project Structure

- `app/`: web app UI and runtime logic
- `android/`: Android shell and packaging
- `profiles/`: built-in and imported profile bundles
- Local packaged profile archives are optional and ignored by Git
- `tests/`: automated tests

## Status

This repository is under active development.

# liu-hen
联系我请到qq邮箱3305614102@qq.com
## 中文介绍

`liu-hen` 是一个微信风格的 AI 数字分身应用。它的目标不是只做一个普通聊天框，而是把蒸馏后的聊天记录、人物设定和关系记忆，变成一个可以持续对话、主动联系、发表情包、发朋友圈的数字联系人。

项目当前以 `Web App + Android WebView Shell` 为核心，支持本地优先的 profile 管理，并直接接入模型 API。

### 功能特性

- 导入蒸馏后的 profile，并加载成长期存在的联系人
- 在微信风格的聊天界面里持续对话
- 保留关系记忆和上下文连续性
- 支持主动私聊、表情包互动、朋友圈动态
- 支持打包为 Android APK
- 支持导入由 [`perkfly/ex-skill`](https://github.com/perkfly/ex-skill) 蒸馏得到的 zip 包

### 项目结构

- `app/`：Web 前端界面与运行时逻辑
- `android/`：Android 壳、桥接与打包工程
- `profiles/`：解包后的 profile 源目录
- `tests/`：自动化测试

### 导入说明

本项目支持导入 profile `.zip` 包。

- 原生 `exprofile` 格式需要包含：
  `meta.json`、`persona.md`、`relationship_context.md`、`response_patterns.md`、`memories.md`、`sticker_profile.json`、`sticker_library.json`
- 原版 `perkfly/ex-skill` 格式也可直接导入，至少需要包含：
  `meta.json`、`SKILL.md`、`persona.md`、`memories.md`
- 推荐先借助开源项目 [`perkfly/ex-skill`](https://github.com/perkfly/ex-skill) 完成蒸馏，再导入到本应用中运行

完整导入格式说明见：
[profile-import-format.md](</<workspace>/前任skill/docs/profile-import-format.md>)

### 仓库说明

体积较大的本地 `.exprofile.zip` 文件默认不纳入 Git 跟踪。仓库中以解包后的 profile 目录作为可追踪来源，zip 包只作为本地导入、测试或 Android 内置资源使用。

## English

`liu-hen` is a WeChat-style AI companion app focused on turning distilled chat history into a persistent digital persona. Instead of being only a chat UI, it aims to simulate an ongoing relationship through memory, proactive messages, stickers, and moments-style interactions.

The project is currently built around a `Web App + Android WebView shell` architecture, with local-first profile management and direct model API integration.

### Features

- Import distilled profiles and load them as persistent contacts
- Chat in a familiar WeChat-like interface
- Preserve relationship memory and conversation continuity
- Support proactive private chat, sticker interaction, and moments dynamics
- Package the experience as an Android APK
- Support zip packages distilled with [`perkfly/ex-skill`](https://github.com/perkfly/ex-skill)

### Project Structure

- `app/`: web UI and runtime logic
- `android/`: Android shell, bridge, and packaging
- `profiles/`: unpacked profile source directories
- `tests/`: automated tests

### Profile Import

This app accepts profile `.zip` packages.

- Native `exprofile` bundles must include:
  `meta.json`, `persona.md`, `relationship_context.md`, `response_patterns.md`, `memories.md`, `sticker_profile.json`, `sticker_library.json`
- Original `perkfly/ex-skill` bundles are also supported and should include at least:
  `meta.json`, `SKILL.md`, `persona.md`, `memories.md`
- A recommended workflow is to distill with [`perkfly/ex-skill`](https://github.com/perkfly/ex-skill) first, then import the generated zip into this app

See the full format guide here:
[profile-import-format.md](</<workspace>/前任skill/docs/profile-import-format.md>)

### Repository Notes

Large local `.exprofile.zip` archives are intentionally not tracked in Git. The repository keeps unpacked profile folders as the source of truth, while packaged zip files remain local build or import artifacts.

# 前任

把聊天、图片、备注和导出的结构化结果整理成一个可回滚的 ex profile。

## 何时使用
- 新建 profile：逻辑上可称为 `create-ex`
- 查看已有 profile：逻辑上可称为 `list-exes`
- 回退某个版本：逻辑上可称为 `ex-rollback`

## 输入
- 原始聊天记录、截图、照片、补充备注
- 已导出的结构化 JSON
- 现有 profile 的版本目录

优先使用 exporter 产出的结构化 JSON，不要为了省事去反解析原始文本。
如果已经有 `schema/` 或工具输出的 JSON，就把它当作主来源；只有缺失时才补读原始文本。

## 工作流
1. 先确认目标 profile 名称，落到 `exes/<slug>/`。
2. 读取已有 `meta.json` 和版本目录，避免覆盖用户已整理的内容。
3. 生成或更新六个输出文件。
4. 如需回滚，用 `versions/<version>/` 里的快照恢复当前文件。
5. 更新 `meta.json` 里的版本标记和时间戳。

本地命令可按下列逻辑理解：
- `create-ex` 对应 `python tools/skill_writer.py --action create --base-dir <workspace>\前任skill\exes`
- `list-exes` 对应 `python tools/skill_writer.py --action list --base-dir <workspace>\前任skill\exes`
- `ex-rollback` 对应 `python tools\version_manager.py --action rollback --base-dir <workspace>\前任skill\exes`

## 输出
- `meta.json`
- `memories.md`
- `persona.md`
- `relationship_context.md`
- `response_patterns.md`
- `sticker_profile.json`

## 约定
- `memories.md` 记稳定事实和重要回忆。
- `persona.md` 记表达气质、边界、第一人称视角。
- `relationship_context.md` 记双方关系张力、默认互动方式、敏感点。
- `response_patterns.md` 记常见回复结构、语气转换、长度偏好。
- `sticker_profile.json` 记表情包/贴纸偏好，保持结构化。
- `meta.json` 记 slug、名称、创建时间、当前版本和回滚时间。

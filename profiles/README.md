# Distilled Profiles

这个目录用于存放不同人物的蒸馏 profile。

每个人单独一个子目录：

```text
profiles/
  person-slug/
    meta.json
    memories.md
    persona.md
    relationship_context.md
    response_patterns.md
    sticker_profile.json
    evidence/
    versions/
```

约定：

- `meta.json` 记录人物名、slug、来源 JSON、消息数量、生成时间和版本。
- `memories.md` 记录稳定事实、共同记忆和重要上下文。
- `persona.md` 记录说话气质、边界、表达习惯和第一人称视角。
- `relationship_context.md` 记录这个人与用户之间的关系状态、敏感点和互动惯性。
- `response_patterns.md` 记录典型触发场景下的回复模式。
- `sticker_profile.json` 记录表情包、贴纸、emoji 和标点习惯。
- `evidence/` 放支撑画像判断的样例、摘录或统计。
- `versions/` 放历史版本快照，方便回滚。

后续导入新的 JSON 时，优先在这里创建对应人物目录，不覆盖已有 profile。

补充说明：

- 本地生成的 `.exprofile.zip` 打包文件默认不纳入 Git。
- 这个仓库里以解包后的目录内容作为可追踪来源，zip 只作为本地导入或本地打包产物存在。

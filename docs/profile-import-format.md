# Profile Import Format

This project supports importing profile archives as `.zip` packages.

## Supported zip formats

### 1. App-native `exprofile` zip

Recommended when you already have a packaged profile bundle for this app.

Required files:

```text
meta.json
persona.md
relationship_context.md
response_patterns.md
memories.md
sticker_profile.json
sticker_library.json
```

Optional content:

```text
stickers/
knowledge/
versions/
```

### 2. Original `perkfly/ex-skill` zip

This app also supports the original skill package style from the open-source project:

[perkfly/ex-skill](https://github.com/perkfly/ex-skill)

Required files:

```text
meta.json
SKILL.md
persona.md
memories.md
```

Optional content:

```text
knowledge/
versions/
```

When importing this format, the app will adapt it into its internal runtime bundle automatically.

## Recommended workflow

The recommended way to build a persona archive is:

1. Distill chat history with `perkfly/ex-skill`
2. Prepare the output as either:
   - an original `ex-skill` package
   - or an app-native `exprofile` package
3. Import the `.zip` file into the app

## Notes

- The imported file must be a `.zip` archive.
- If required files are missing, import will fail with a missing-files error.
- Large local `.exprofile.zip` archives are intentionally not tracked in this repository.

# dsh-minimax-h3

MiniMax H3 image and video tools, a local balance ledger, and a MiniMax
workspace in the right sidebar of DeepSeek Harness.

- Pure ESM. No build step, no runtime dependencies.
- Six tools: `minimax_h3_image`, `minimax_h3_edit_image`, `minimax_h3_video`,
  `minimax_h3_enhance_prompt`, `minimax_h3_media_status`,
  `minimax_h3_media_list`.
- Right sidebar → guide → MiniMax: create, history, settings.
- Create: pick an image or video task, fill its parameters, submit directly.
- History: filter by type/status, read dates, open results, modify, or delete.
- Running videos are queried automatically every 7 seconds; history shows elapsed
  time and the last check, and stops auto-checking after 30 minutes.
- Failed videos can be retried in text, first/last-frame, or reference mode when
  the original source materials are available.
- Modify: select a result in History, then describe the change in the composer.
- Settings: connection, models, interface language, local balance and alert.
- Menus support click-outside/Escape dismissal and keyboard arrow navigation.
- Data and generated media live under `$DSH_HOME/plugins/dsh-minimax-h3` by
  default; the API key is read from the shared `MINIMAX_API_KEY` credential.
- Balance and prices are local estimates; an ordinary MiniMax key cannot read
  the real balance.

## Requirements

- DeepSeek Harness 0.2.2 or newer, Web or Desktop.
- Node.js 24 or newer.
- A MiniMax API key.

## Install

Install the published package from **Plugins → Add plugin**, or add the
repository as a local bundle:

```text
Plugins → Add plugin → choose the dsh-minimax-h3 directory
```

After enabling it, open a session and use the MiniMax tab in the right sidebar.

## Data and privacy

- Prompts, reference images, reference videos, and reference audio are sent to
  the MiniMax API at the configured base URL when you submit a task.
- Generated files, task records, pending references, and local settings are
  stored under `$DSH_HOME/plugins/dsh-minimax-h3` by default.
- The plugin has no telemetry of its own. It does not send data anywhere except
  the configured MiniMax endpoint and the local DSH host.
- The API key is stored in the shared `MINIMAX_API_KEY` credential.
- Uninstalling the plugin does not delete the credential, generated files, or
  task records.
- Balance and cost figures are local estimates, not a MiniMax statement.

## Disclaimer

This is an unofficial plugin. It is not affiliated with or endorsed by MiniMax.
The MiniMax name and logo are used only to identify the upstream service; make
sure you have the right to redistribute any brand asset included here.

See `docs/DETAIL.md` for the feature image and the plugin description for
usage and limits.

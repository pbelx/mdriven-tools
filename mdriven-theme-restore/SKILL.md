---
name: mdriven-theme-restore
description: Diagnose transparent, unstyled, or unexpectedly themed MDriven Turnkey pages and safely restore the standard compiled theme CSS. Use when a local Turnkey site has missing backgrounds, theme CSS returns 404, or theme files were renamed, emptied, or left uncompiled.
---

# MDriven Theme Restore

Use the bundled PowerShell script to inspect the same theme precedence used by MDriven Turnkey:

1. `Content/scss/theme-user.css`
2. `Content/theme-user.css`
3. `Content/theme-default.css`

An existing empty user theme still shadows the default theme. Structural `core.css` alone can leave surfaces looking transparent.

## Diagnose

Run read-only diagnosis first:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/restore_mdriven_theme.ps1
```

Pass `-Root <path>` for a nonstandard Turnkey directory and `-Port <port>` to verify the served default stylesheet over HTTP.

## Repair

Only use `-Repair` when the user asked to restore or fix the theme. It copies a validated `Content/theme-default-old.css` back to `Content/theme-default.css` and disables only zero-byte user themes by renaming them with a timestamp. Existing files are backed up; nothing is deleted.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/restore_mdriven_theme.ps1 -Repair
```

Use `-SourceCss <path>` if the verified default comes from another installation. Use `-ForceDefault` with `-Repair` only when the user explicitly wants to disable a nonempty custom theme as well. Honor filesystem approval requirements before writing outside the workspace.

Report the effective theme, source and destination hashes, files renamed or backed up, HTTP result when requested, and whether a browser refresh is needed. Do not restart the server unless separately requested; static CSS is normally picked up immediately.

# Web Project Rules

- Treat this repository as the authoritative standalone version of Tic Tac Toe Plus.
- Do not read from, compare with, or modify the former Unity project.
- Keep domain logic, state, UI, animation, audio, networking, platform integration, and assets in focused modules.
- Keep methods short and avoid duplicated behavior across game modes.
- Do not add comments to source code.
- Run tests, lint, and the production build after changes.
- Publish successful changes automatically unless the user explicitly asks to keep them local.
- Keep Android signing secrets and keystores under `android-config/private`, which must remain ignored by Git.

# Feature Research & Engineering: Remote CLI Agent Runner

> **Feature Goal**: Securely trigger, monitor, and cancel command-line developer tools (specifically `antigravity-cli` / `agy`, Git, build runners, and system controls) from a mobile phone, providing real-time stdout streaming and Dynamic Island HUD visualization.

---

## 1. Technical Requirements

1. **Agent Control**: Ability to run Antigravity CLI commands (`agy run`, `agy status`, `agy test`) and custom scripts with a single tap from mobile.
2. **Terminal Streaming**: Stream stdout/stderr back to mobile so developers can monitor execution logs from their phone.
3. **Island HUD Visualization**: When a command is triggered, the Dynamic Island expands, displays the running command, an animated gear/spinner, and a "Cancel / Kill" action button.
4. **Strict RCE Prevention**: The system must be immune to shell injection, argument injection, and unauthenticated remote code execution.

---

## 2. Research & Exploration History

### Attempt 1: Raw Shell String Execution (Failed & Unsafe)
- **Concept**: Mobile sends raw shell strings: `{"cmd": "agy run --task 'build website'"}`. Desktop executes via `std::process::Command::new("sh").arg("-c").arg(cmd)`.
- **Why it Failed & Why it was Dangerous**:
  - Catastrophic Remote Code Execution (RCE) risk. If a malicious Bluetooth packet was forged, an attacker could append `; rm -rf ~` or run reverse shells.
  - Environment differences: Running via `sh -c` bypasses user `.bashrc` or `.zshrc` paths where tools like `agy`, `cargo`, and `nvm` are configured, causing `"command not found"` errors.

### Attempt 2: Stateless Single-Execution Output Capture (Suboptimal)
- **Concept**: Execute the binary and only return the final output once the command terminates.
- **Why it Failed**:
  - Developer agents like `agy` or compilation commands can run for 30 seconds to several minutes. A silent phone screen with no output caused users to think the app froze or the Bluetooth link disconnected.

### Attempt 3: Whitelist-Driven PTY Engine with Line Streaming (Selected Architecture)
- **Concept**:
  1. Desktop enforces a **strict whitelist configuration file** (`config/whitelist.json`).
  2. The mobile phone references commands by **pre-configured Aliases** (e.g., `cmd: "agy-run"`).
  3. Commands execute via a pseudo-terminal (PTY) or direct tokenized `std::process::Command` without invoking an intermediate shell.
  4. Stdout and Stderr are streamed line-by-line over BLE as numbered chunk packets.
  5. The mobile app can issue an explicit `SIGINT` (Ctrl+C) packet to cancel long-running tasks.

---

## 3. Whitelist Configuration Model

The desktop daemon maintains an explicit whitelist that can be edited in the Settings window:

```json
{
  "version": 1,
  "allow_custom_arguments": false,
  "commands": [
    {
      "id": "agy-status",
      "title": "Check Antigravity Status",
      "program": "agy",
      "args": ["status"],
      "working_dir": null,
      "requires_biometrics": false
    },
    {
      "id": "agy-run-goal",
      "title": "Run Antigravity Autonomous Goal",
      "program": "agy",
      "args": ["run"],
      "working_dir": null,
      "requires_biometrics": true
    },
    {
      "id": "git-pull-main",
      "title": "Git Pull Origin Main",
      "program": "git",
      "args": ["pull", "origin", "main"],
      "working_dir": null,
      "requires_biometrics": false
    },
    {
      "id": "sys-lock",
      "title": "Lock Desktop Screen",
      "program": "loginctl",
      "args": ["lock-session"],
      "working_dir": null,
      "requires_biometrics": false
    }
  ]
}
```

---

## 4. Execution Lifecycle & Island State Management

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Mobile taps "Run agy goal" (Biometric prompt verified)    │
│ 2. BLE delivers packet: {"type": "EXEC_CMD", "id": "agy-run"}│
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Rust Whitelist Engine verifies "agy-run" exists          │
│ 4. Rust spawns child process with piped stdout/stderr       │
│ 5. Island Window transitions:                               │
│    • Width expands to 420px                                 │
│    • Mascot morphs to "Working with Goggles"                │
│    • Displays spinner + live terminal tail (last 2 lines)   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Process streams lines -> Rust sends BLE log chunks        │
│ 7. Process exits:                                           │
│    • Code 0 -> Mascot "Cheering / Success", green dot       │
│    • Non-zero -> Mascot "Dizzy / Error", red dot            │
│ 8. After 4 seconds, Island shrinks smoothly back to Pill    │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Security Guardrails

- **Zero Shell Invocation**: The command execution never calls `/bin/sh`, `bash`, or `cmd.exe`. Arguments are passed as discrete string slices directly to the OS kernel `execve` system call.
- **Process Isolation & Timeouts**: If a command exceeds a maximum allowed execution limit (default: 300 seconds), the desktop daemon automatically terminates the child process (`SIGKILL`).
- **Resource Throttling**: Only **one** active CLI task can run at a time to prevent denial-of-service or runaway background jobs.

---

## 6. Multi-Session Telemetry & Active Project Folder Resolution

In modern developer workflows, multiple AI coding agents (`Antigravity CLI`, `Claude Code`, `Codex`, `OpenCodeInterpreter`) often run in the background. Soko includes a dedicated telemetry subsystem to monitor, resolve, and display active agent operations on the Dynamic Island HUD.

### 6.1 Four-Tier Workspace Resolution Pipeline
Rather than displaying a generic agent label or blank directory, `soko_bridge.js` automatically derives the exact active project directory through a robust four-tier resolution pipeline:

1. **SQLite Database Trajectory Inspection**:
   - Queries `conversation_summaries.db` in `~/.gemini/antigravity*` to locate matching session IDs and read the recorded `workspace_dir`.
   - Reads session trajectory JSON in `conversations/<sessionId>.db` to extract session metadata.
2. **Tool-Call Trajectory Parsing**:
   - Parses the active session's tool call arguments (`read_file`, `write_file`, `run_command`, `edit_file`).
   - Extracts absolute file paths and normalizes them to determine the project root directory.
3. **Repository Root Boundary Derivation**:
   - Inspects the working directory tree upwards to locate `.git` or `package.json` boundaries, extracting the project basename (e.g. `soko`, `frontend-service`).
4. **Environment Override**:
   - Supports the `SOKO_WORKSPACE` environment variable for explicitly bounded developer environments.

### 6.2 Island HUD Presentation & Auto-Wake Transitions
- **Project Folder Chips**: Active agents display a styled project badge (e.g., `[soko]`, `[backend]`) inside the Dynamic Island HUD and the Quick Settings popover.
- **Cognitive Mood Synchronization**: The mascot dynamically shifts moods (`working`, `thinking`, `alert`) based on agent execution states.
- **Task Completion Notifications & Token Metrics**:
  - When an agent completes its task, Soko automatically wakes from idle orb mode to normal mode.
  - Displays a high-visibility completion banner highlighting formatted token usage (e.g. `14.5k tokens`) and task summaries.
  - Automatically resets to idle after 20 seconds unless interacted with.

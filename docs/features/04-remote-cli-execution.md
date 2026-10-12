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

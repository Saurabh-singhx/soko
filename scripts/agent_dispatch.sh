#!/usr/bin/env bash
# Antigravity Multi-VM Agent Dispatcher with Automated Scoped Code Sync
#
# Commands:
#   ./scripts/agent_dispatch.sh status
#   ./scripts/agent_dispatch.sh start [vm1|vm2|all]
#   ./scripts/agent_dispatch.sh stop [vm1|vm2|all]
#   ./scripts/agent_dispatch.sh sync [vm1|vm2|all]
#   ./scripts/agent_dispatch.sh pull <vm1|vm2|all>
#   ./scripts/agent_dispatch.sh run <vm1|vm2> "<prompt>" [mode] [effort] [timeout_secs]

set -euo pipefail

PROJECT_DIR="/home/saurabh/coding/soko"
VM1_IP="192.168.122.54"
VM2_IP="192.168.122.174"
VM_USER="saurabh"
REMOTE_DIR="/home/saurabh/soko"
LIBVIRT_URI="qemu:///system"
LOCK_FILE="/tmp/soko_agent_dispatch.lock"
LOG_DIR="${PROJECT_DIR}/logs"
LOG_FILE="${LOG_DIR}/dispatch.log"

# Domain boundaries (relative to PROJECT_DIR)
VM1_OWNED_PATHS=(
    "packages"
    "apps/desktop/src-tauri"
)

VM2_OWNED_PATHS=(
    "apps/desktop/src"
    "apps/mobile"
    "tests"
)

# Robust rsync exclusion rules
RSYNC_EXCLUDES=(
    # Secret keys & credentials
    --exclude '.env*'
    --exclude '*.key'
    --exclude '*.pem'
    --exclude '*.keystore'
    --exclude '*.p12'
    --exclude 'credentials*'
    --exclude 'google-services.json'
    --exclude 'scripts/keystore'

    # Build outputs & caches
    --exclude '/dist'
    --exclude '/dist-desktop'
    --exclude '/transfers'
    --exclude 'node_modules'
    --exclude '.git'
    --exclude 'target'
    --exclude '.dart_tool'
    --exclude '.gradle'
    --exclude 'build'
    --exclude '*.apk'
    --exclude '*.idsig'
    --exclude '*.aab'
    --exclude '*.mp4'
    --exclude '*.mp3'
    --exclude '/logs'
)

# Concurrency lock
acquire_lock() {
    exec 9>"$LOCK_FILE"
    if ! flock -n 9; then
        echo "Error: Another agent_dispatch operation is currently running." >&2
        exit 1
    fi
}

log_dispatch() {
    local target="$1"
    local mode="$2"
    local effort="$3"
    local exit_code="$4"
    local duration="$5"
    local prompt="$6"

    mkdir -p "$LOG_DIR"
    local timestamp
    timestamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo "${timestamp} | target=${target} | mode=${mode} | effort=${effort} | rc=${exit_code} | dur=${duration}s | prompt=\"${prompt:0:80}...\"" >> "$LOG_FILE"
}

check_network() {
    local ip="$1"
    nc -z -w 2 "$ip" 22 >/dev/null 2>&1
}

check_agent_health() {
    local ip="$1"
    if ! check_network "$ip"; then
        return 1
    fi
    ssh -o BatchMode=yes -o ConnectTimeout=3 -o StrictHostKeyChecking=no "${VM_USER}@${ip}" \
        'export PATH="$HOME/.local/bin:$PATH"; agy --version' >/dev/null 2>&1
}

start_vm_if_offline() {
    local domain="$1"
    local ip="$2"

    if check_agent_health "$ip"; then
        return 0
    fi

    echo "Target node ($domain / $ip) is not ready. Attempting libvirt boot..."
    virsh -c "$LIBVIRT_URI" start "$domain" >/dev/null 2>&1 || true

    local attempts=0
    while [ $attempts -lt 20 ]; do
        if check_agent_health "$ip"; then
            echo "Target node ($domain) is online and agy CLI is responsive."
            return 0
        fi
        sleep 2
        attempts=$((attempts + 1))
    done

    echo "Warning: Node $domain failed to become fully ready after 40s." >&2
    return 1
}

sync_to_vm() {
    local target="$1"
    local ip="$2"
    echo "Pushing workspace snapshot to $target ($ip)..."
    ssh -o BatchMode=yes -o StrictHostKeyChecking=no "${VM_USER}@${ip}" "mkdir -p ${REMOTE_DIR}"
    rsync -az "${RSYNC_EXCLUDES[@]}" "${PROJECT_DIR}/" "${VM_USER}@${ip}:${REMOTE_DIR}/"
}

pull_scoped_from_vm() {
    local target="$1"
    local ip="$2"
    echo "Pulling domain-scoped changes from $target ($ip)..."

    local paths=()
    if [ "$target" = "vm1" ]; then
        paths=("${VM1_OWNED_PATHS[@]}")
    elif [ "$target" = "vm2" ]; then
        paths=("${VM2_OWNED_PATHS[@]}")
    fi

    for rel_path in "${paths[@]}"; do
        if ssh -o BatchMode=yes -o StrictHostKeyChecking=no "${VM_USER}@${ip}" "[ -e '${REMOTE_DIR}/${rel_path}' ]"; then
            mkdir -p "${PROJECT_DIR}/${rel_path}"
            rsync -az --delete "${RSYNC_EXCLUDES[@]}" \
                "${VM_USER}@${ip}:${REMOTE_DIR}/${rel_path}/" \
                "${PROJECT_DIR}/${rel_path}/"
        fi
    done
}

cmd_status() {
    echo "=== Soko Antigravity Multi-VM Fleet Status ==="
    for vm_info in "VM 1 (Backend & Systems)|$VM1_IP|antigravity-vm1" "VM 2 (Frontend & QA)|$VM2_IP|antigravity-vm2"; do
        IFS="|" read -r label ip domain <<< "$vm_info"
        if check_agent_health "$ip"; then
            echo "$label: ONLINE & AGY READY ($ip)"
        elif check_network "$ip"; then
            echo "$label: SSH UP, AGY NOT RESPONDING ($ip)"
        else
            local v_state
            v_state="$(virsh -c "$LIBVIRT_URI" domstate "$domain" 2>/dev/null || echo "unknown")"
            echo "$label: OFFLINE ($ip, libvirt: $v_state)"
        fi
    done
}

cmd_start() {
    local target="${1:-all}"
    acquire_lock

    if [ "$target" = "vm1" ] || [ "$target" = "all" ]; then
        echo "Starting VM 1 (antigravity-vm1)..."
        virsh -c "$LIBVIRT_URI" start antigravity-vm1 2>&1 || true
    fi
    if [ "$target" = "vm2" ] || [ "$target" = "all" ]; then
        echo "Starting VM 2 (antigravity-vm2)..."
        virsh -c "$LIBVIRT_URI" start antigravity-vm2 2>&1 || true
    fi

    echo "Waiting for guest agents to initialize..."
    local attempts=0
    while [ $attempts -lt 20 ]; do
        local ok=1
        if [ "$target" = "vm1" ] || [ "$target" = "all" ]; then
            check_agent_health "$VM1_IP" || ok=0
        fi
        if [ "$target" = "vm2" ] || [ "$target" = "all" ]; then
            check_agent_health "$VM2_IP" || ok=0
        fi
        if [ $ok -eq 1 ]; then break; fi
        sleep 2
        attempts=$((attempts + 1))
    done
    cmd_status
}

cmd_stop() {
    local target="${1:-all}"
    acquire_lock

    if [ "$target" = "vm1" ] || [ "$target" = "all" ]; then
        echo "Shutting down VM 1 (antigravity-vm1)..."
        virsh -c "$LIBVIRT_URI" shutdown antigravity-vm1 2>&1 || true
    fi
    if [ "$target" = "vm2" ] || [ "$target" = "all" ]; then
        echo "Shutting down VM 2 (antigravity-vm2)..."
        virsh -c "$LIBVIRT_URI" shutdown antigravity-vm2 2>&1 || true
    fi
    echo "Shutdown signal dispatched."
}

cmd_sync() {
    local target="${1:-all}"
    acquire_lock

    if [ "$target" = "vm1" ] || [ "$target" = "all" ]; then
        if check_network "$VM1_IP"; then sync_to_vm "vm1" "$VM1_IP"; fi
    fi
    if [ "$target" = "vm2" ] || [ "$target" = "all" ]; then
        if check_network "$VM2_IP"; then sync_to_vm "vm2" "$VM2_IP"; fi
    fi
}

cmd_pull() {
    local target="${1:-}"
    acquire_lock

    if [ "$target" = "vm1" ]; then
        pull_scoped_from_vm "vm1" "$VM1_IP"
    elif [ "$target" = "vm2" ]; then
        pull_scoped_from_vm "vm2" "$VM2_IP"
    elif [ "$target" = "all" ]; then
        if check_network "$VM1_IP"; then pull_scoped_from_vm "vm1" "$VM1_IP"; fi
        if check_network "$VM2_IP"; then pull_scoped_from_vm "vm2" "$VM2_IP"; fi
    else
        echo "Usage: $0 pull <vm1|vm2|all>" >&2
        exit 1
    fi
}

cmd_run() {
    local target="${1:-}"
    local prompt="${2:-}"
    local mode="${3:-auto}"
    local effort="${4:-medium}"
    local custom_timeout="${5:-}"

    if [ -z "$target" ] || [ -z "$prompt" ]; then
        echo "Usage: $0 run <vm1|vm2> \"<prompt>\" [mode] [effort] [timeout_secs]" >&2
        exit 1
    fi

    local ip="" domain=""
    if [ "$target" = "vm1" ]; then
        ip="$VM1_IP"
        domain="antigravity-vm1"
    elif [ "$target" = "vm2" ]; then
        ip="$VM2_IP"
        domain="antigravity-vm2"
    else
        echo "Error: Unknown target '$target'. Must be 'vm1' or 'vm2'." >&2
        exit 1
    fi

    # Determine execution timeout budget
    local timeout_secs
    if [ -n "$custom_timeout" ]; then
        timeout_secs="$custom_timeout"
    else
        case "$effort" in
            low) timeout_secs=300 ;;
            medium) timeout_secs=900 ;;
            high|xhigh) timeout_secs=1800 ;;
            max) timeout_secs=2700 ;;
            *) timeout_secs=900 ;;
        esac
    fi

    acquire_lock
    local start_time
    start_time="$(date +%s)"

    # 1. Health & Auto-Boot verification
    if ! start_vm_if_offline "$domain" "$ip"; then
        echo "[FALLBACK] Target $target ($ip) is unavailable. Executing locally on Host..."
        cd "$PROJECT_DIR"
        agy --mode "$mode" --effort "$effort" -p "$prompt"
        local host_rc=$?
        local end_time; end_time="$(date +%s)"
        log_dispatch "host-fallback" "$mode" "$effort" "$host_rc" "$((end_time - start_time))" "$prompt"
        return $host_rc
    fi

    # 2. Push latest snapshot
    sync_to_vm "$target" "$ip"

    # 3. Construct quote-safe remote command with PATH guaranteed
    local remote_cmd
    remote_cmd="export PATH=\"\$HOME/.local/bin:\$PATH\"; cd $(printf %q "$REMOTE_DIR") && agy --mode $(printf %q "$mode") --effort $(printf %q "$effort") --dangerously-skip-permissions -p $(printf %q "$prompt")"

    echo "Dispatching to $target ($ip) [mode: $mode, effort: $effort, timeout: ${timeout_secs}s]..."

    set +e
    timeout "${timeout_secs}" ssh -o BatchMode=yes \
        -o ServerAliveInterval=15 \
        -o ServerAliveCountMax=3 \
        -o StrictHostKeyChecking=no \
        "${VM_USER}@${ip}" "$remote_cmd"
    local rc=$?
    set -e

    local end_time
    end_time="$(date +%s)"
    local duration=$((end_time - start_time))
    log_dispatch "$target" "$mode" "$effort" "$rc" "$duration" "$prompt"

    # 4. Handle results & fallback
    if [ $rc -eq 0 ]; then
        echo "Remote task succeeded. Pulling domain-scoped artifacts..."
        pull_scoped_from_vm "$target" "$ip"
        echo "=== Task completed and synced cleanly to Host (${duration}s) ==="
        return 0
    elif [ $rc -eq 124 ]; then
        echo "[TIMEOUT] Task timed out after ${timeout_secs}s on $target ($ip)." >&2
    else
        echo "[FAILED] Task failed with exit code $rc on $target ($ip)." >&2
    fi

    echo "Remote task was not successful. Host tree left clean (no changes pulled)."
    echo "[FALLBACK] Executing task locally on Host..."
    cd "$PROJECT_DIR"
    agy --mode "$mode" --effort "$effort" -p "$prompt"
    return $?
}

case "${1:-status}" in
    status) cmd_status ;;
    start) shift; cmd_start "$@" ;;
    stop) shift; cmd_stop "$@" ;;
    sync) shift; cmd_sync "$@" ;;
    pull) shift; cmd_pull "$@" ;;
    run) shift; cmd_run "$@" ;;
    *)
        echo "Usage: $0 {status|start|stop|sync [vm1|vm2|all]|pull <vm1|vm2|all>|run <vm1|vm2> \"<prompt>\" [mode] [effort] [timeout]}" >&2
        exit 1
        ;;
esac

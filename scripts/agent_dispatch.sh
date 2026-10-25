#!/usr/bin/env bash
# Antigravity Multi-VM Agent Dispatcher with Automated Code Sync
# Usage:
#   ./scripts/agent_dispatch.sh status
#   ./scripts/agent_dispatch.sh sync [vm1|vm2|all]
#   ./scripts/agent_dispatch.sh pull <vm1|vm2>
#   ./scripts/agent_dispatch.sh run <vm1|vm2> "<prompt>" [mode] [effort]

set -euo pipefail

PROJECT_DIR="/home/saurabh/coding/soko"
VM1_IP="192.168.122.54"
VM2_IP="192.168.122.174"
VM_USER="saurabh"
REMOTE_DIR="/home/saurabh/soko"

RSYNC_EXCLUDES=(
    --exclude 'node_modules'
    --exclude '.git'
    --exclude 'dist'
    --exclude 'dist-desktop'
    --exclude 'transfers'
    --exclude 'target'
    --exclude 'src-tauri/target'
    --exclude '*.mp4'
    --exclude '*.mp3'
)

check_health() {
    local ip="$1"
    nc -z -w 2 "$ip" 22 >/dev/null 2>&1
}

sync_to_vm() {
    local target="$1"
    local ip="$2"
    echo "Syncing code to $target ($ip)..."
    rsync -az "${RSYNC_EXCLUDES[@]}" "${PROJECT_DIR}/" "${VM_USER}@${ip}:${REMOTE_DIR}/"
}

pull_from_vm() {
    local target="$1"
    local ip="$2"
    echo "Pulling changes from $target ($ip)..."
    rsync -az "${RSYNC_EXCLUDES[@]}" "${VM_USER}@${ip}:${REMOTE_DIR}/" "${PROJECT_DIR}/"
}

cmd_status() {
    echo "=== Antigravity Multi-VM Status ==="
    if check_health "$VM1_IP"; then
        echo "VM 1 ($VM1_IP): ONLINE (Backend & Systems)"
    else
        echo "VM 1 ($VM1_IP): OFFLINE"
    fi

    if check_health "$VM2_IP"; then
        echo "VM 2 ($VM2_IP): ONLINE (Frontend & QA)"
    else
        echo "VM 2 ($VM2_IP): OFFLINE"
    fi
}

cmd_start() {
    echo "Starting Antigravity VMs via libvirt..."
    virsh -c qemu:///system start antigravity-vm1 2>&1 || true
    virsh -c qemu:///system start antigravity-vm2 2>&1 || true
    echo "Waiting for network & SSH daemons to be ready..."
    local attempts=0
    while [ $attempts -lt 15 ]; do
        if check_health "$VM1_IP" && check_health "$VM2_IP"; then
            break
        fi
        sleep 2
        attempts=$((attempts + 1))
    done
    cmd_status
}

cmd_stop() {
    echo "Gracefully shutting down Antigravity VMs..."
    virsh -c qemu:///system shutdown antigravity-vm1 2>&1 || true
    virsh -c qemu:///system shutdown antigravity-vm2 2>&1 || true
    echo "Shutdown signal sent to both VMs."
}

cmd_sync() {
    local target="${1:-all}"
    if [ "$target" = "vm1" ] || [ "$target" = "all" ]; then
        if check_health "$VM1_IP"; then sync_to_vm "vm1" "$VM1_IP"; fi
    fi
    if [ "$target" = "vm2" ] || [ "$target" = "all" ]; then
        if check_health "$VM2_IP"; then sync_to_vm "vm2" "$VM2_IP"; fi
    fi
}

cmd_pull() {
    local target="${1:-}"
    if [ "$target" = "vm1" ]; then
        pull_from_vm "vm1" "$VM1_IP"
    elif [ "$target" = "vm2" ]; then
        pull_from_vm "vm2" "$VM2_IP"
    else
        echo "Usage: $0 pull <vm1|vm2>"
        exit 1
    fi
}

cmd_run() {
    local target="${1:-}"
    local prompt="${2:-}"
    local mode="${3:-auto}"
    local effort="${4:-medium}"

    if [ -z "$target" ] || [ -z "$prompt" ]; then
        echo "Usage: $0 run <vm1|vm2> \"<prompt>\" [mode] [effort]"
        exit 1
    fi

    local ip=""
    if [ "$target" = "vm1" ]; then
        ip="$VM1_IP"
    elif [ "$target" = "vm2" ]; then
        ip="$VM2_IP"
    else
        echo "Error: Unknown target '$target'. Must be 'vm1' or 'vm2'."
        exit 1
    fi

    # 1. Health check before dispatch
    if ! check_health "$ip"; then
        echo "FALLBACK_TRIGGERED: Target $target ($ip) is OFFLINE."
        echo "Executing task locally on Host..."
        cd "$PROJECT_DIR"
        agy --mode "$mode" --effort "$effort" --dangerously-skip-permissions -p "$prompt"
        return $?
    fi

    # 2. Push latest code to VM
    sync_to_vm "$target" "$ip"

    # 3. Execute agy inside the project directory on remote VM
    echo "Dispatching to $target ($ip) [mode: $mode, effort: $effort]..."
    ssh -o BatchMode=yes -o ConnectTimeout=5 "${VM_USER}@${ip}" \
        "cd ${REMOTE_DIR} && agy --mode '$mode' --effort '$effort' --dangerously-skip-permissions -p '$prompt'"

    # 4. Pull modified code back to Host
    pull_from_vm "$target" "$ip"
    echo "=== Task finished and synced back to Host ==="
}

case "${1:-status}" in
    status)
        cmd_status
        ;;
    start)
        cmd_start
        ;;
    stop)
        cmd_stop
        ;;
    sync)
        shift
        cmd_sync "$@"
        ;;
    pull)
        shift
        cmd_pull "$@"
        ;;
    run)
        shift
        cmd_run "$@"
        ;;
    *)
        echo "Usage: $0 {status|start|stop|sync [vm1|vm2|all]|pull <vm1|vm2>|run <vm1|vm2> \"<prompt>\" [mode] [effort]}"
        exit 1
        ;;
esac

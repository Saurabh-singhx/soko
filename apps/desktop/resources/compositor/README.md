# Soko Dynamic Island — Wayland Compositor Presets

This directory contains preset window rules and layer-shell integration configurations for pure Wayland tiling window managers and compositors.

## Hyprland Integration
Add the following line to your `~/.config/hypr/hyprland.conf`:
```conf
source = ~/.config/hypr/hyprland-soko.conf
```
Or copy the rules from [`hyprland-soko.conf`](./hyprland-soko.conf) directly into your configuration.

## Sway / i3 Integration
Add the following line to your `~/.config/sway/config`:
```conf
include ~/.config/sway/sway-soko.conf
```
Or copy the rules from [`sway-soko.conf`](./sway-soko.conf).

## Running Soko on Wayland
By default on Linux, Soko detects whether an X11 server (XWayland) is active and uses `--ozone-platform=x11` for seamless transparent overlay positioning.

To force native Wayland mode without XWayland, launch with:
```bash
SOKO_WAYLAND=1 soko
# or
soko --wayland
```
When running on pure Wayland sessions where `DISPLAY` is unset, Soko automatically switches to `--ozone-platform=wayland` and applies `toolbar` surface hints.

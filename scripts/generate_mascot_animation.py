#!/usr/bin/env python3
"""
Generate a high-fidelity animated GIF of the Soko mascot face.
Replicates the Grok Bot aesthetic with complete micro-expressions and Music Equalizer Mode:
- Deep OLED visor with titanium rim
- Aerodynamic ear-fins with subtle kinematic spring responses
- Organic top-down eyelid morphing, ballistic blinks, inquisitive smirks, scanning saccades
- Vibrant musical equalizer spectrum eyes with dancing bars and floating music note ♪
- Joyful happy arcs (^ ^) and thoughtful upward gaze
"""
import os
import math
import shutil
import subprocess
import cairo

WIDTH, HEIGHT = 256, 256
FPS = 30
TOTAL_FRAMES = 240  # 8.0 seconds seamless loop

OUTPUT_DIR = "/tmp/soko_frames"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Helper easing functions
def ease_in_out(t):
    return 0.5 * (1 - math.cos(math.pi * t))

def lerp(a, b, t):
    return a + (b - a) * t

def draw_capsule(ctx, x, y, w, h, r):
    r = min(r, w / 2.0, h / 2.0)
    ctx.new_sub_path()
    ctx.arc(x + r, y + r, r, math.pi, 1.5 * math.pi)
    ctx.arc(x + w - r, y + r, r, 1.5 * math.pi, 2 * math.pi)
    ctx.arc(x + w - r, y + h - r, r, 0, 0.5 * math.pi)
    ctx.arc(x + r, y + h - r, r, 0.5 * math.pi, math.pi)
    ctx.close_path()

def draw_music_note(ctx, cx, cy, alpha=1.0):
    ctx.save()
    ctx.set_source_rgba(0.20, 0.83, 0.60, alpha)
    # Note head (tilted ellipse)
    ctx.save()
    ctx.translate(cx - 0.5, cy + 0.8)
    ctx.rotate(-0.35)
    ctx.scale(1.1, 0.8)
    ctx.arc(0, 0, 0.9, 0, 2 * math.pi)
    ctx.fill()
    ctx.restore()

    # Stem
    ctx.set_line_width(0.35)
    ctx.set_line_cap(cairo.LINE_CAP_ROUND)
    ctx.move_to(cx + 0.45, cy + 0.8)
    ctx.line_to(cx + 0.45, cy - 2.0)
    ctx.stroke()

    # Flag
    ctx.move_to(cx + 0.45, cy - 2.0)
    ctx.curve_to(cx + 1.6, cy - 1.6, cx + 1.8, cy - 0.8, cx + 1.2, cy - 0.4)
    ctx.stroke()
    ctx.restore()

def render_frame(frame_idx, total_frames):
    surface = cairo.ImageSurface(cairo.FORMAT_ARGB32, WIDTH, HEIGHT)
    ctx = cairo.Context(surface)
    scale = WIDTH / 44.0
    ctx.scale(scale, scale)

    # Base Animation State Variables
    head_tilt = 0.0
    head_y = 0.0
    left_ear_rot = 0.0
    right_ear_rot = 0.0
    gaze_x = 0.0
    gaze_y = 0.0

    # Eye parameters (baseline bottom = 28.0)
    left_top = 16.0
    left_h = 12.0
    left_scale_x = 1.0
    left_tilt = 0.0

    right_top = 16.0
    right_h = 12.0
    right_scale_x = 1.0
    right_tilt = 0.0

    # Mode blend factors
    music_mode = 0.0   # 0.0 = normal, 1.0 = full music equalizer
    happy_morph = 0.0  # 0.0 = normal, 1.0 = happy arc

    f = frame_idx

    # =========================================================================
    # Phase 1: Neutral Alert Focus & Ambient Breathing (Frames 0 - 24, 0.0s - 0.8s)
    # =========================================================================
    if f < 25:
        breath = math.sin(f / 25.0 * math.pi) * 0.35
        gaze_y = -breath * 0.5

    # =========================================================================
    # Phase 2: Organic Double Blink (Frames 25 - 42, 0.83s - 1.4s)
    # =========================================================================
    elif f < 43:
        bf = f - 25
        if bf < 4:  # Blink 1 drop
            p = bf / 4.0
            drop = 10.8 * p
            left_top = 16.0 + drop
            left_h = max(1.2, 12.0 - drop)
            right_top = left_top
            right_h = left_h
        elif bf < 9:  # Blink 1 spring reopen
            p = (bf - 4) / 5.0
            drop = 10.8 * (1.0 - ease_in_out(p))
            left_top = 16.0 + drop
            left_h = max(1.2, 12.0 - drop)
            right_top = left_top
            right_h = left_h
        elif bf < 12:  # Micro flutter 2 drop
            p = (bf - 9) / 3.0
            drop = 7.0 * p
            left_top = 16.0 + drop
            left_h = max(3.0, 12.0 - drop)
            right_top = left_top
            right_h = left_h
        else:  # Micro flutter 2 reopen
            p = (bf - 12) / 6.0
            drop = 7.0 * (1.0 - p)
            left_top = 16.0 + drop
            left_h = max(1.2, 12.0 - drop)
            right_top = left_top
            right_h = left_h

    # =========================================================================
    # Phase 3: Inquisitive Smirk & Head Tilt (Frames 43 - 75, 1.43s - 2.5s)
    # =========================================================================
    elif f < 76:
        cf = f - 43
        if cf < 12:  # Move into smirk
            p = ease_in_out(cf / 12.0)
            head_tilt = p * 2.8
            right_ear_rot = p * 12.0
            right_top = 16.0 + p * 5.2
            right_h = 12.0 - p * 5.2
            right_tilt = -p * 4.0
            gaze_x = p * 0.8
        elif cf < 23:  # Hold smirk
            head_tilt = 2.8
            right_ear_rot = 12.0
            right_top = 21.2
            right_h = 6.8
            right_tilt = -4.0
            gaze_x = 0.8
        else:  # Return to neutral
            p = ease_in_out((cf - 23) / 10.0)
            head_tilt = 2.8 * (1.0 - p)
            right_ear_rot = 12.0 * (1.0 - p)
            right_top = 21.2 - p * 5.2
            right_h = 6.8 + p * 5.2
            right_tilt = -4.0 * (1.0 - p)
            gaze_x = 0.8 * (1.0 - p)

    # =========================================================================
    # Phase 4: Saccadic Glance Left & Scan Right (Frames 76 - 105, 2.53s - 3.5s)
    # =========================================================================
    elif f < 106:
        sf = f - 76
        if sf < 6:  # Saccade jump left
            p = ease_in_out(sf / 6.0)
            gaze_x = -3.0 * p
            left_scale_x = 1.0 - 0.12 * p
            left_ear_rot = -p * 8.0
        elif sf < 14:  # Hold glance left
            gaze_x = -3.0
            left_scale_x = 0.88
            left_ear_rot = -8.0
        elif sf < 24:  # Smooth sweep to right
            p = ease_in_out((sf - 14) / 10.0)
            gaze_x = lerp(-3.0, 3.0, p)
            left_scale_x = lerp(0.88, 1.05, p)
            right_scale_x = lerp(1.05, 0.88, p)
            left_ear_rot = lerp(-8.0, 4.0, p)
            right_ear_rot = lerp(0.0, 8.0, p)
        else:  # Return to center
            p = ease_in_out((sf - 24) / 6.0)
            gaze_x = lerp(3.0, 0.0, p)
            left_scale_x = lerp(1.05, 1.0, p)
            right_scale_x = lerp(0.88, 1.0, p)
            left_ear_rot = lerp(4.0, 0.0, p)
            right_ear_rot = lerp(8.0, 0.0, p)

    # =========================================================================
    # Phase 5: MUSIC EQUALIZER MODE! 🎵 (Frames 106 - 165, 3.53s - 5.5s)
    # =========================================================================
    elif f < 166:
        mf = f - 106
        music_t = mf / 30.0

        # Fade in music mode over 6 frames
        if mf < 6:
            music_mode = mf / 6.0
        elif mf > 54:
            music_mode = (60 - mf) / 6.0
        else:
            music_mode = 1.0

        # Rhythmic head bob & ear bouncing to the beat
        head_y = 0.4 * math.sin(music_t * 14.0) * music_mode
        left_ear_rot = (-8.0 + 7.0 * math.sin(music_t * 14.0)) * music_mode
        right_ear_rot = (8.0 - 7.0 * math.sin(music_t * 14.0)) * music_mode

    # =========================================================================
    # Phase 6: Joyful Happy Morph (^ ^) & Ear Perk (Frames 166 - 200, 5.53s - 6.67s)
    # =========================================================================
    elif f < 201:
        hf = f - 166
        if hf < 8:  # Morph into happy arcs
            p = ease_in_out(hf / 8.0)
            happy_morph = p
            left_ear_rot = -p * 14.0
            right_ear_rot = p * 14.0
            gaze_y = -p * 0.8
        elif hf < 26:  # Rhythmic happy ear bounce
            happy_morph = 1.0
            bounce = math.sin((hf - 8) / 18.0 * 2 * math.pi) * 3.5
            left_ear_rot = -14.0 + bounce
            right_ear_rot = 14.0 - bounce
            gaze_y = -0.8 + (math.sin((hf - 8) / 18.0 * 2 * math.pi) * 0.35)
        else:  # Morph back to capsules
            p = ease_in_out((hf - 26) / 9.0)
            happy_morph = 1.0 - p
            left_ear_rot = -14.0 * (1.0 - p)
            right_ear_rot = 14.0 * (1.0 - p)
            gaze_y = -0.8 * (1.0 - p)

    # =========================================================================
    # Phase 7: Thinking Upward Gaze & Seamless Re-centering (Frames 201 - 240, 6.7s - 8.0s)
    # =========================================================================
    else:
        tf = f - 201
        if tf < 14:  # Gaze upward
            p = ease_in_out(tf / 14.0)
            gaze_y = -p * 2.0
            right_ear_rot = p * 6.0
        elif tf < 26:  # Hold thinking
            gaze_y = -2.0
            right_ear_rot = 6.0
        else:  # Soft re-centering blink back to Frame 0
            p = (tf - 26) / 13.0
            blink_p = math.sin(p * math.pi)
            drop = blink_p * 8.5
            left_top = 16.0 + drop
            left_h = max(2.5, 12.0 - drop)
            right_top = left_top
            right_h = left_h
            gaze_y = -2.0 * (1.0 - p)
            right_ear_rot = 6.0 * (1.0 - p)

    # Apply Head Pose Translation & Rotation
    ctx.save()
    ctx.translate(22, 22 + head_y)
    ctx.rotate(math.radians(head_tilt))
    ctx.translate(-22, -22)

    # Draw Left Ear-Fin Antenna
    ctx.save()
    ctx.translate(8, 17)
    ctx.rotate(math.radians(left_ear_rot))
    ctx.translate(-8, -17)

    ear_grad = cairo.LinearGradient(0, 0, 15, 20)
    ear_grad.add_color_stop_rgb(0, 0.16, 0.16, 0.20)
    ear_grad.add_color_stop_rgb(1, 0.05, 0.05, 0.08)
    ctx.set_source(ear_grad)

    ctx.move_to(7, 17)
    ctx.curve_to(4, 13, 4, 8, 8, 10)
    ctx.curve_to(9, 13, 8, 18, 7, 17)
    ctx.close_path()
    ctx.fill_preserve()
    ctx.set_source_rgba(1, 1, 1, 0.55)
    ctx.set_line_width(0.9)
    ctx.stroke()
    ctx.restore()

    # Draw Right Ear-Fin Antenna
    ctx.save()
    ctx.translate(36, 17)
    ctx.rotate(math.radians(right_ear_rot))
    ctx.translate(-36, -17)

    ear_grad_r = cairo.LinearGradient(44, 0, 29, 20)
    ear_grad_r.add_color_stop_rgb(0, 0.16, 0.16, 0.20)
    ear_grad_r.add_color_stop_rgb(1, 0.05, 0.05, 0.08)
    ctx.set_source(ear_grad_r)

    ctx.move_to(37, 17)
    ctx.curve_to(40, 13, 40, 8, 36, 10)
    ctx.curve_to(35, 13, 36, 18, 37, 17)
    ctx.close_path()
    ctx.fill_preserve()
    ctx.set_source_rgba(1, 1, 1, 0.55)
    ctx.set_line_width(0.9)
    ctx.stroke()
    ctx.restore()

    # Draw Deep OLED Black Visor Dome
    radial = cairo.RadialGradient(22 * 0.8, 22 * 0.7, 1.5, 22, 22, 16)
    radial.add_color_stop_rgb(0, 0.09, 0.09, 0.11)
    radial.add_color_stop_rgb(0.65, 0.02, 0.02, 0.03)
    radial.add_color_stop_rgb(1.0, 0.0, 0.0, 0.0)
    ctx.set_source(radial)
    ctx.arc(22, 22, 16, 0, 2 * math.pi)
    ctx.fill_preserve()

    # Titanium Rim Stroke
    rim = cairo.LinearGradient(4, 4, 40, 40)
    rim.add_color_stop_rgba(0, 1, 1, 1, 0.5)
    rim.add_color_stop_rgba(0.5, 0.55, 0.55, 0.60, 0.3)
    rim.add_color_stop_rgba(1, 1, 1, 1, 0.45)
    ctx.set_source(rim)
    ctx.set_line_width(1.2)
    ctx.stroke()

    # Clip Ocular Screen Assembly to Visor Interior
    ctx.save()
    ctx.arc(22, 22, 15, 0, 2 * math.pi)
    ctx.clip()

    # Eye Group Gaze Shift
    ctx.save()
    ctx.translate(gaze_x, gaze_y)

    # -------------------------------------------------------------------------
    # Render Eyes Based on Active Blend Modes
    # -------------------------------------------------------------------------
    if music_mode > 0.001:
        # Music Equalizer Mode Active
        normal_alpha = 1.0 - music_mode
        if normal_alpha > 0.01:
            ctx.set_source_rgba(1, 1, 1, normal_alpha)
            draw_capsule(ctx, 12.5, left_top, 7.0, left_h, 3.5)
            ctx.fill()
            draw_capsule(ctx, 24.5, right_top, 7.0, right_h, 3.5)
            ctx.fill()

        # Equalizer Spectrum Gradient
        eq_grad = cairo.LinearGradient(0, 28, 0, 16)
        eq_grad.add_color_stop_rgba(0.0, 0.06, 0.73, 0.51, music_mode)   # #10B981 emerald
        eq_grad.add_color_stop_rgba(0.5, 0.20, 0.83, 0.60, music_mode)   # #34D399 mint
        eq_grad.add_color_stop_rgba(1.0, 0.38, 0.65, 0.98, music_mode)   # #60A5FA blue
        ctx.set_source(eq_grad)

        # Time-based dancing heights for 8 equalizer bars
        mt = (f - 106) / 30.0
        h1 = 6.8 + 4.2 * math.sin(mt * 13.0)
        h2 = 8.5 + 3.2 * math.sin(mt * 17.5 + 1.2)
        h3 = 6.2 + 4.8 * math.sin(mt * 11.8 + 2.5)
        h4 = 4.8 + 3.5 * math.sin(mt * 15.6 + 0.8)

        h5 = 5.0 + 3.6 * math.sin(mt * 15.0 + 1.8)
        h6 = 7.0 + 4.2 * math.sin(mt * 11.2 + 0.5)
        h7 = 8.6 + 3.1 * math.sin(mt * 17.0 + 2.0)
        h8 = 6.2 + 4.4 * math.sin(mt * 13.2 + 3.1)

        bars_x = [12.5, 14.3, 16.1, 17.9, 24.6, 26.4, 28.2, 30.0]
        bars_h = [h1, h2, h3, h4, h5, h6, h7, h8]

        for bx, bh in zip(bars_x, bars_h):
            clamped_h = max(2.5, min(12.0, bh))
            draw_capsule(ctx, bx, 28.0 - clamped_h, 1.4, clamped_h, 0.7)
            ctx.fill()

        # Floating glowing vector music note ♪
        note_y = 22.0 + 1.1 * math.sin(mt * 8.0)
        draw_music_note(ctx, 22.0, note_y, alpha=0.92 * music_mode)

    elif happy_morph > 0.001:
        # Happy Arcs (^ ^)
        arc_opacity = happy_morph
        capsule_opacity = 1.0 - happy_morph

        if capsule_opacity > 0.01:
            ctx.set_source_rgba(1, 1, 1, capsule_opacity)
            draw_capsule(ctx, 12.5, left_top, 7.0, left_h, 3.5)
            ctx.fill()
            draw_capsule(ctx, 24.5, right_top, 7.0, right_h, 3.5)
            ctx.fill()

        ctx.set_source_rgba(1, 1, 1, arc_opacity)
        ctx.set_line_width(2.6)
        ctx.set_line_cap(cairo.LINE_CAP_ROUND)

        # Left Happy Arc
        ctx.move_to(12.8, 22.8)
        ctx.curve_to(13.2, 18.0, 17.8, 17.2, 19.4, 22.0)
        ctx.stroke()

        # Right Happy Arc
        ctx.move_to(24.6, 22.0)
        ctx.curve_to(26.2, 17.2, 30.8, 18.0, 31.2, 22.8)
        ctx.stroke()

    else:
        # Normal / Inquisitive Morphing Eyes
        ctx.set_source_rgba(1, 1, 1, 0.98)

        # Left Eye
        ctx.save()
        ctx.translate(16.0, 28.0)
        ctx.rotate(math.radians(left_tilt))
        ctx.scale(left_scale_x, 1.0)
        ctx.translate(-16.0, -28.0)
        draw_capsule(ctx, 12.5, left_top, 7.0, left_h, 3.5)
        ctx.fill()
        ctx.restore()

        # Right Eye
        ctx.save()
        ctx.translate(28.0, 28.0)
        ctx.rotate(math.radians(right_tilt))
        ctx.scale(right_scale_x, 1.0)
        ctx.translate(-28.0, -28.0)
        draw_capsule(ctx, 24.5, right_top, 7.0, right_h, 3.5)
        ctx.fill()
        ctx.restore()

    ctx.restore()  # End Gaze Shift
    ctx.restore()  # End Screen Clip
    ctx.restore()  # End Head Pose

    out_file = os.path.join(OUTPUT_DIR, f"frame_{frame_idx:04d}.png")
    surface.write_to_png(out_file)

def main():
    print(f"Generating {TOTAL_FRAMES} frames...")
    for i in range(TOTAL_FRAMES):
        render_frame(i, TOTAL_FRAMES)
        if (i + 1) % 40 == 0:
            print(f"  Frame {i + 1}/{TOTAL_FRAMES} rendered")

    target_gif = "/home/saurabh/coding/soko/docs/assets/soko-mascot.gif"
    print("Encoding transparent animated GIF with ffmpeg...")

    cmd = [
        "ffmpeg", "-y",
        "-framerate", str(FPS),
        "-i", os.path.join(OUTPUT_DIR, "frame_%04d.png"),
        "-filter_complex", "[0:v] split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=00000000 [p]; [b][p] paletteuse=alpha_threshold=128",
        target_gif
    ]
    subprocess.run(cmd, check=True)
    file_size = os.path.getsize(target_gif)
    print(f"Successfully generated: {target_gif} ({file_size / 1024:.1f} KB)")

    shutil.rmtree(OUTPUT_DIR, ignore_errors=True)

if __name__ == '__main__':
    main()

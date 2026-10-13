#!/usr/bin/env python3
"""
Generate a high-fidelity animated GIF of the Soko mascot face.
Replicates the Grok Bot aesthetic:
- Deep OLED visor with titanium rim
- Aerodynamic ear-fins with subtle kinematic spring responses
- Organic top-down eyelid morphing, ballistic blinks, inquisitive smirks, scanning saccades, and happy arcs
"""
import os
import math
import shutil
import subprocess
import cairo

WIDTH, HEIGHT = 256, 256
FPS = 30
TOTAL_FRAMES = 180  # 6.0 seconds seamless loop

OUTPUT_DIR = "/tmp/soko_frames"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Helper easing functions
def ease_in_out(t):
    return 0.5 * (1 - math.cos(math.pi * t))

def ease_out_back(t, s=1.70158):
    t -= 1
    return (t * t * ((s + 1) * t + s) + 1)

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

def render_frame(frame_idx, total_frames):
    t_sec = frame_idx / FPS
    surface = cairo.ImageSurface(cairo.FORMAT_ARGB32, WIDTH, HEIGHT)
    ctx = cairo.Context(surface)
    scale = WIDTH / 44.0
    ctx.scale(scale, scale)

    # Animation State Variables
    head_tilt = 0.0
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

    happy_morph = 0.0  # 0.0 = capsule, 1.0 = happy arc

    # Choreography phases across 180 frames (6.0s)
    f = frame_idx

    # 1. Neutral Idle with subtle breathing (0 - 26, 0.0s - 0.87s)
    if f < 27:
        breath = math.sin(f / 27.0 * math.pi) * 0.4
        gaze_y = -breath * 0.5

    # 2. Organic Double Blink (27 - 44, 0.9s - 1.47s)
    elif f < 45:
        bf = f - 27
        if bf < 4:  # Blink 1 close
            p = bf / 4.0
            drop = 10.8 * p
            left_top = 16.0 + drop
            left_h = max(1.2, 12.0 - drop)
            right_top = left_top
            right_h = left_h
        elif bf < 9:  # Blink 1 reopen
            p = (bf - 4) / 5.0
            drop = 10.8 * (1.0 - ease_in_out(p))
            left_top = 16.0 + drop
            left_h = max(1.2, 12.0 - drop)
            right_top = left_top
            right_h = left_h
        elif bf < 12:  # Micro flutter 2 close
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

    # 3. Inquisitive Smirk & Curious Head Tilt (45 - 80, 1.5s - 2.67s)
    elif f < 81:
        cf = f - 45
        if cf < 15:  # Move into smirk
            p = ease_in_out(cf / 15.0)
            head_tilt = p * 2.8
            right_ear_rot = p * 12.0
            right_top = 16.0 + p * 5.2
            right_h = 12.0 - p * 5.2
            right_tilt = -p * 4.0
            gaze_x = p * 0.8
        elif cf < 26:  # Hold smirk
            head_tilt = 2.8
            right_ear_rot = 12.0
            right_top = 21.2
            right_h = 6.8
            right_tilt = -4.0
            gaze_x = 0.8
        else:  # Return to center
            p = ease_in_out((cf - 26) / 10.0)
            head_tilt = 2.8 * (1.0 - p)
            right_ear_rot = 12.0 * (1.0 - p)
            right_top = 21.2 - p * 5.2
            right_h = 6.8 + p * 5.2
            right_tilt = -4.0 * (1.0 - p)
            gaze_x = 0.8 * (1.0 - p)

    # 4. Saccadic Glance Left & Scan Right (81 - 116, 2.7s - 3.87s)
    elif f < 117:
        sf = f - 81
        if sf < 6:  # Saccade quick jump left
            p = ease_in_out(sf / 6.0)
            gaze_x = -3.0 * p
            left_scale_x = 1.0 - 0.12 * p
            left_ear_rot = -p * 8.0
        elif sf < 18:  # Hold glance left
            gaze_x = -3.0
            left_scale_x = 0.88
            left_ear_rot = -8.0
        elif sf < 30:  # Smooth sweep to right
            p = ease_in_out((sf - 18) / 12.0)
            gaze_x = lerp(-3.0, 3.0, p)
            left_scale_x = lerp(0.88, 1.05, p)
            right_scale_x = lerp(1.05, 0.88, p)
            left_ear_rot = lerp(-8.0, 4.0, p)
            right_ear_rot = lerp(0.0, 8.0, p)
        else:  # Return to center
            p = ease_in_out((sf - 30) / 6.0)
            gaze_x = lerp(3.0, 0.0, p)
            left_scale_x = lerp(1.05, 1.0, p)
            right_scale_x = lerp(0.88, 1.0, p)
            left_ear_rot = lerp(4.0, 0.0, p)
            right_ear_rot = lerp(8.0, 0.0, p)

    # 5. Joyful Happy Morph (^ ^) & Ear Perk (117 - 152, 3.9s - 5.07s)
    elif f < 153:
        hf = f - 117
        if hf < 8:  # Morph into happy arcs
            p = ease_in_out(hf / 8.0)
            happy_morph = p
            left_ear_rot = -p * 14.0
            right_ear_rot = p * 14.0
            gaze_y = -p * 0.8
        elif hf < 27:  # Rhythmic happy bounce
            happy_morph = 1.0
            bounce = math.sin((hf - 8) / 19.0 * 2 * math.pi) * 4.0
            left_ear_rot = -14.0 + bounce
            right_ear_rot = 14.0 - bounce
            gaze_y = -0.8 + (math.sin((hf - 8) / 19.0 * 2 * math.pi) * 0.4)
        else:  # Morph back to capsules
            p = ease_in_out((hf - 27) / 9.0)
            happy_morph = 1.0 - p
            left_ear_rot = -14.0 * (1.0 - p)
            right_ear_rot = 14.0 * (1.0 - p)
            gaze_y = -0.8 * (1.0 - p)

    # 6. Thinking Upward Gaze & Re-centering (153 - 180, 5.1s - 6.0s)
    else:
        tf = f - 153
        if tf < 12:  # Gaze upward
            p = ease_in_out(tf / 12.0)
            gaze_y = -p * 2.0
            right_ear_rot = p * 6.0
        elif tf < 20:  # Hold thinking
            gaze_y = -2.0
            right_ear_rot = 6.0
        else:  # Soft blink & re-center smoothly to frame 0
            p = (tf - 20) / 7.0
            # Quick soft blink during re-center
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
    ctx.translate(22, 22)
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

    if happy_morph > 0.01:
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
        if (i + 1) % 30 == 0:
            print(f"  Frame {i + 1}/{TOTAL_FRAMES} rendered")

    target_gif = "/home/saurabh/coding/soko/docs/assets/soko-mascot.gif"
    print("Encoding transparent animated GIF using ffmpeg...")
    
    # 2-pass high quality palettegen with transparency preservation
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

    # Clean up temporary frames
    shutil.rmtree(OUTPUT_DIR, ignore_errors=True)

if __name__ == '__main__':
    main()

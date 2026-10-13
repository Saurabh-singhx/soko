#!/usr/bin/env python3
"""
Generate sleek, high-resolution Soko app icons (PNG and ICO) for Linux and Windows desktop builds.
"""
import os
from PIL import Image, ImageDraw

def create_soko_icon(size=512):
    # Create RGBA canvas
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    pad = size // 16
    radius = size // 5

    # Rounded rectangle background (deep space dark glass #090A0F)
    bg_box = [pad, pad, size - pad, size - pad]
    draw.rounded_rectangle(bg_box, radius=radius, fill=(9, 10, 15, 255), outline=(94, 106, 210, 180), width=max(2, size // 64))

    # Inner glowing dynamic island pill
    pill_w = size * 0.62
    pill_h = size * 0.22
    pill_x0 = (size - pill_w) / 2
    pill_y0 = size * 0.26
    pill_x1 = pill_x0 + pill_w
    pill_y1 = pill_y0 + pill_h
    pill_radius = pill_h / 2

    # Draw glow behind pill
    glow_box = [pill_x0 - 4, pill_y0 - 4, pill_x1 + 4, pill_y1 + 4]
    draw.rounded_rectangle(glow_box, radius=pill_radius + 4, fill=(94, 106, 210, 40))

    # Draw dark pill
    draw.rounded_rectangle([pill_x0, pill_y0, pill_x1, pill_y1], radius=pill_radius, fill=(18, 20, 24, 255), outline=(255, 255, 255, 45), width=max(1, size // 128))

    # Mascot face inside/below pill
    # Glowing bot eyes (Linear cyan/indigo #5E6AD2 & #00D2B4)
    eye_radius = size // 32
    eye_y = size * 0.37
    left_eye_x = size * 0.42
    right_eye_x = size * 0.58

    draw.ellipse([left_eye_x - eye_radius, eye_y - eye_radius, left_eye_x + eye_radius, eye_y + eye_radius], fill=(94, 106, 210, 255))
    draw.ellipse([right_eye_x - eye_radius, eye_y - eye_radius, right_eye_x + eye_radius, eye_y + eye_radius], fill=(0, 210, 180, 255))

    # Antenna / Signal wave arc
    wave_bbox = [size * 0.38, size * 0.60, size * 0.62, size * 0.76]
    draw.arc(wave_bbox, start=200, end=340, fill=(94, 106, 210, 220), width=max(2, size // 48))

    wave2_bbox = [size * 0.43, size * 0.65, size * 0.57, size * 0.77]
    draw.arc(wave2_bbox, start=200, end=340, fill=(0, 210, 180, 200), width=max(2, size // 64))

    # Small center dot for antenna transmitter
    center_dot_r = size // 64
    center_dot_y = size * 0.73
    draw.ellipse([size * 0.50 - center_dot_r, center_dot_y - center_dot_r, size * 0.50 + center_dot_r, center_dot_y + center_dot_r], fill=(255, 255, 255, 240))

    return img

def main():
    build_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../apps/desktop/build'))
    icons_dir = os.path.join(build_dir, 'icons')
    os.makedirs(icons_dir, exist_ok=True)

    img512 = create_soko_icon(512)
    png_path = os.path.join(build_dir, 'icon.png')
    img512.save(png_path, format='PNG')
    print(f"Generated 512x512 icon: {png_path}")

    # Generate icons folder for linux/windows
    sizes = [16, 32, 48, 64, 128, 256, 512]
    icon_images = []
    for s in sizes:
        resized = img512.resize((s, s), Image.Resampling.LANCZOS)
        s_path = os.path.join(icons_dir, f"{s}x{s}.png")
        resized.save(s_path, format='PNG')
        if s in [16, 32, 48, 64, 128, 256]:
            icon_images.append(resized)

    # Generate Windows .ico
    ico_path = os.path.join(build_dir, 'icon.ico')
    img512.save(ico_path, format='ICO', sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print(f"Generated Windows ICO: {ico_path}")

if __name__ == '__main__':
    main()

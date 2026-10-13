#!/usr/bin/env python3
import os
import math
from PIL import Image, ImageDraw, ImageFilter

def create_mascot_logo(size=512, is_round=False):
    # Canvas
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    margin = size * 0.05
    box = [margin, margin, size - margin, size - margin]
    radius = (size - 2 * margin) / 2 if is_round else size * 0.22

    # Background squircle / circle
    # Subtle dark gradient background
    bg = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(bg)
    
    # Draw dark surface (#090B10 to #131722)
    if is_round:
        bg_draw.ellipse(box, fill=(9, 11, 16, 255), outline=(255, 255, 255, 45), width=max(2, int(size * 0.015)))
    else:
        bg_draw.rounded_rectangle(box, radius=radius, fill=(9, 11, 16, 255), outline=(255, 255, 255, 45), width=max(2, int(size * 0.015)))

    img = Image.alpha_composite(img, bg)
    draw = ImageDraw.Draw(img)

    # Inner subtle glow ring
    inner_margin = margin + size * 0.02
    inner_box = [inner_margin, inner_margin, size - inner_margin, size - inner_margin]
    inner_radius = (size - 2 * inner_margin) / 2 if is_round else radius - size * 0.02
    glow_overlay = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow_overlay)
    if is_round:
        glow_draw.ellipse(inner_box, outline=(99, 102, 241, 60), width=max(1, int(size * 0.01)))
    else:
        glow_draw.rounded_rectangle(inner_box, radius=inner_radius, outline=(99, 102, 241, 60), width=max(1, int(size * 0.01)))
    img = Image.alpha_composite(img, glow_overlay)

    # Eyes configuration matching Soko Grok Bot mascot:
    # 2 vertical white capsule eyes
    eye_w = size * 0.115
    eye_h = size * 0.24
    eye_r = eye_w / 2
    spacing = size * 0.14
    center_y = size * 0.50

    left_x = (size / 2) - (spacing / 2) - eye_w
    right_x = (size / 2) + (spacing / 2)

    top_y = center_y - (eye_h / 2)
    bottom_y = center_y + (eye_h / 2)

    # Soft glowing layer behind eyes
    glow_layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow_layer)
    glow_pad = size * 0.03
    glow_draw.rounded_rectangle([left_x - glow_pad, top_y - glow_pad, left_x + eye_w + glow_pad, bottom_y + glow_pad], radius=eye_r + glow_pad, fill=(255, 255, 255, 110))
    glow_draw.rounded_rectangle([right_x - glow_pad, top_y - glow_pad, right_x + eye_w + glow_pad, bottom_y + glow_pad], radius=eye_r + glow_pad, fill=(255, 255, 255, 110))
    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(radius=size * 0.025))
    img = Image.alpha_composite(img, glow_layer)

    # Sharp white pill eyes
    eyes_layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    eyes_draw = ImageDraw.Draw(eyes_layer)
    eyes_draw.rounded_rectangle([left_x, top_y, left_x + eye_w, bottom_y], radius=eye_r, fill=(255, 255, 255, 255))
    eyes_draw.rounded_rectangle([right_x, top_y, right_x + eye_w, bottom_y], radius=eye_r, fill=(255, 255, 255, 255))
    img = Image.alpha_composite(img, eyes_layer)

    return img

def main():
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    mobile_res = os.path.join(root, 'apps/mobile/res')
    os.makedirs(os.path.join(mobile_res, 'drawable'), exist_ok=True)
    os.makedirs(os.path.join(mobile_res, 'mipmap-hdpi'), exist_ok=True)
    os.makedirs(os.path.join(mobile_res, 'mipmap-mdpi'), exist_ok=True)
    os.makedirs(os.path.join(mobile_res, 'mipmap-xhdpi'), exist_ok=True)
    os.makedirs(os.path.join(mobile_res, 'mipmap-xxhdpi'), exist_ok=True)
    os.makedirs(os.path.join(mobile_res, 'mipmap-xxxhdpi'), exist_ok=True)

    img512 = create_mascot_logo(512, is_round=False)
    img512_round = create_mascot_logo(512, is_round=True)

    # Save to companion folder as well
    img512.save(os.path.join(root, 'apps/mobile/companion/icon.png'))
    img512.save(os.path.join(mobile_res, 'drawable/ic_launcher.png'))
    img512_round.save(os.path.join(mobile_res, 'drawable/ic_launcher_round.png'))

    density_map = {
        'mipmap-mdpi': 48,
        'mipmap-hdpi': 72,
        'mipmap-xhdpi': 96,
        'mipmap-xxhdpi': 144,
        'mipmap-xxxhdpi': 192,
    }

    for folder, dim in density_map.items():
        resized = img512.resize((dim, dim), Image.Resampling.LANCZOS)
        resized_round = img512_round.resize((dim, dim), Image.Resampling.LANCZOS)
        resized.save(os.path.join(mobile_res, folder, 'ic_launcher.png'))
        resized_round.save(os.path.join(mobile_res, folder, 'ic_launcher_round.png'))

    print("Successfully generated all Soko Bot mascot launcher icons!")

if __name__ == '__main__':
    main()

import math
import struct
import zlib
import os

def create_png(width, height, get_pixel):
    raw = bytearray()
    for y in range(height):
        raw.append(0)  # no filter
        for x in range(width):
            r, g, b, a = get_pixel(x, y, width, height)
            raw.append(max(0, min(255, int(r))))
            raw.append(max(0, min(255, int(g))))
            raw.append(max(0, min(255, int(b))))
            raw.append(max(0, min(255, int(a))))
            
    compressed = zlib.compress(bytes(raw), 9)
    
    def chunk(tag, data):
        c = struct.pack('>I', len(data)) + tag + data
        crc = zlib.crc32(tag + data) & 0xffffffff
        return c + struct.pack('>I', crc)
    
    header = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))
    idat = chunk(b'IDAT', compressed)
    iend = chunk(b'IEND', b'')
    return header + ihdr + idat + iend

def dist_segment(px, py, x1, y1, x2, y2):
    dx = x2 - x1
    dy = y2 - y1
    l2 = dx*dx + dy*dy
    if l2 == 0:
        return math.hypot(px - x1, py - y1)
    t = max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / l2))
    proj_x = x1 + t * dx
    proj_y = y1 + t * dy
    return math.hypot(px - proj_x, py - proj_y)

def dist_rounded_rect(px, py, rx, ry, rw, rh, rad):
    # Centered box coordinates
    cx = rx + rw / 2.0
    cy = ry + rh / 2.0
    dx = abs(px - cx) - (rw / 2.0 - rad)
    dy = abs(py - cy) - (rh / 2.0 - rad)
    
    qx = max(dx, 0.0)
    qy = max(dy, 0.0)
    outer_dist = math.hypot(qx, qy) - rad
    inner_dist = min(max(dx, dy), 0.0) - rad
    return outer_dist if outer_dist > 0 else inner_dist

def render_icon(x, y, w, h, is_round=False):
    # Normalized coordinates 0..100
    nx = (x + 0.5) / w * 100.0
    ny = (y + 0.5) / h * 100.0
    
    # Check bounds / circular clipping for round icons
    cx, cy = 50.0, 50.0
    dist_from_center = math.hypot(nx - cx, ny - cy)
    
    if is_round:
        if dist_from_center > 48.5:
            return (0, 0, 0, 0)
        edge_alpha = max(0.0, min(1.0, (48.5 - dist_from_center) / 1.0))
    else:
        # squircle bounds with radius 20
        d_box = dist_rounded_rect(nx, ny, 2.0, 2.0, 96.0, 96.0, 22.0)
        if d_box > 0:
            return (0, 0, 0, 0)
        edge_alpha = max(0.0, min(1.0, -d_box / 0.8))
        
    # Background color: Deep midnight / neon black (#0D0E15)
    bg_r, bg_g, bg_b = 13, 14, 21
    
    # Outer neon border frame:
    # Rectangle from (10, 10) to (90, 90) with corner radius 18
    # Gradient from (#FF3366) bottom-left to (#00FFFF) top-right
    t_grad = (nx + (100.0 - ny)) / 200.0  # 0 at bottom-left, 1 at top-right
    
    # Multi-stop neon gradient:
    # 0.0: #FF3366 (255, 51, 102)
    # 0.5: #FF00FF (255, 0, 255)
    # 1.0: #00FFFF (0, 255, 255)
    if t_grad < 0.5:
        sub_t = t_grad / 0.5
        frame_r = 255
        frame_g = int(51 * (1.0 - sub_t))
        frame_b = int(102 * (1.0 - sub_t) + 255 * sub_t)
    else:
        sub_t = (t_grad - 0.5) / 0.5
        frame_r = int(255 * (1.0 - sub_t))
        frame_g = int(255 * sub_t)
        frame_b = 255
        
    d_frame = abs(dist_rounded_rect(nx, ny, 10.0, 10.0, 80.0, 80.0, 18.0))
    frame_width = 3.2
    
    color_r, color_g, color_b = bg_r, bg_g, bg_b
    
    if d_frame < frame_width:
        # Antialiased frame line
        alpha_f = max(0.0, min(1.0, 1.0 - (d_frame / frame_width)**2))
        color_r = int(color_r * (1.0 - alpha_f) + frame_r * alpha_f)
        color_g = int(color_g * (1.0 - alpha_f) + frame_g * alpha_f)
        color_b = int(color_b * (1.0 - alpha_f) + frame_b * alpha_f)
    elif d_frame < frame_width * 2.5:
        # Subtle neon glow
        alpha_f = 0.25 * (1.0 - (d_frame - frame_width) / (frame_width * 1.5))
        color_r = int(color_r * (1.0 - alpha_f) + frame_r * alpha_f)
        color_g = int(color_g * (1.0 - alpha_f) + frame_g * alpha_f)
        color_b = int(color_b * (1.0 - alpha_f) + frame_b * alpha_f)
        
    # Envelope Icon:
    # Centered mail envelope:
    # Envelope bounds: x from 24 to 76 (width 52), y from 34 to 68 (height 34)
    # Segments:
    # Top: (26, 35) to (74, 35)
    # Bottom: (26, 67) to (74, 67)
    # Left: (25, 36) to (25, 66)
    # Right: (75, 36) to (75, 66)
    # Flap: (25, 35) to (50, 53) and (50, 53) to (75, 35)
    
    env_segs = [
        (26.0, 35.0, 74.0, 35.0),
        (26.0, 67.0, 74.0, 67.0),
        (25.0, 36.0, 25.0, 66.0),
        (75.0, 36.0, 75.0, 66.0),
        (25.0, 35.0, 50.0, 53.0),
        (50.0, 53.0, 75.0, 35.0),
        # Fold creases
        (25.0, 67.0, 42.0, 51.0),
        (75.0, 67.0, 58.0, 51.0),
    ]
    
    min_env_d = 999.0
    for x1, y1, x2, y2 in env_segs:
        d = dist_segment(nx, ny, x1, y1, x2, y2)
        if d < min_env_d:
            min_env_d = d
            
    # Mail color: Neon Cyan / Neon Light Blue (#00FFFF / #4D9FFF)
    env_r, env_g, env_b = 0, 245, 255
    env_w = 2.6
    
    if min_env_d < env_w:
        alpha_env = max(0.0, min(1.0, 1.0 - (min_env_d / env_w)**2))
        color_r = int(color_r * (1.0 - alpha_env) + env_r * alpha_env)
        color_g = int(color_g * (1.0 - alpha_env) + env_g * alpha_env)
        color_b = int(color_b * (1.0 - alpha_env) + env_b * alpha_env)
    elif min_env_d < env_w * 2.8:
        alpha_glow = 0.35 * (1.0 - (min_env_d - env_w) / (env_w * 1.8))
        color_r = int(color_r * (1.0 - alpha_glow) + env_r * alpha_glow)
        color_g = int(color_g * (1.0 - alpha_glow) + env_g * alpha_glow)
        color_b = int(color_b * (1.0 - alpha_glow) + env_b * alpha_glow)
        
    return (color_r, color_g, color_b, int(255 * edge_alpha))

def generate_all():
    sizes = {
        'mipmap-mdpi': 48,
        'mipmap-hdpi': 72,
        'mipmap-xhdpi': 96,
        'mipmap-xxhdpi': 144,
        'mipmap-xxxhdpi': 192,
    }
    
    target_dirs = [
        'android/app/src/main/res',
    ]
    
    for base_dir in target_dirs:
        for folder, sz in sizes.items():
            dir_path = os.path.join(base_dir, folder)
            os.makedirs(dir_path, exist_ok=True)
            
            # Standard launcher icon
            standard_png = create_png(sz, sz, lambda x, y, w, h: render_icon(x, y, w, h, is_round=False))
            with open(os.path.join(dir_path, 'ic_launcher.png'), 'wb') as f:
                f.write(standard_png)
                
            # Round launcher icon
            round_png = create_png(sz, sz, lambda x, y, w, h: render_icon(x, y, w, h, is_round=True))
            with open(os.path.join(dir_path, 'ic_launcher_round.png'), 'wb') as f:
                f.write(round_png)
                
        print(f"Generated launcher icons for {base_dir}")

if __name__ == '__main__':
    generate_all()

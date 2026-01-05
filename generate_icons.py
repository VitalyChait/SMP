import os
from PIL import Image, ImageDraw, ImageFont

def create_icon(size, filename):
    # Create a blue square icon
    img = Image.new('RGB', (size, size), color = '#4267B2')
    d = ImageDraw.Draw(img)
    # Draw a simple white text/shape
    font = ImageFont.truetype("fonts/Roboto-Regular.ttf", size//2)
    d.text((0, size//8), "SMP", fill=(255,255,255), font=font)
    
    img.save(filename)
    print(f"Created {filename}")

if not os.path.exists('icons'):
    os.makedirs('icons')

try:
    create_icon(16, 'icons/icon16.png')
    create_icon(48, 'icons/icon48.png')
    create_icon(128, 'icons/icon128.png')
except ImportError:
    # Fallback if PIL is not installed, use simple file creation or warn
    print("PIL not installed. Installing pillow...")
    import subprocess
    subprocess.check_call(["pip", "install", "pillow"])
    
    # Retry
    from PIL import Image, ImageDraw
    create_icon(16, 'icons/icon16.png')
    create_icon(48, 'icons/icon48.png')
    create_icon(128, 'icons/icon128.png')


import os
from PIL import Image, ImageDraw

def create_icon(size, filename):
    # Create a blue square icon
    img = Image.new('RGB', (size, size), color = '#4267B2')
    d = ImageDraw.Draw(img)
    # Draw a simple white text/shape
    d.text((size//4, size//4), "SP", fill=(255,255,255))
    
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


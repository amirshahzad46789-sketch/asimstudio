import os
from PIL import Image

def optimize_images(assets_dir):
    if not os.path.exists(assets_dir):
        print(f"Directory {assets_dir} not found.")
        return

    # Valid extensions
    valid_exts = ('.jpg', '.jpeg', '.png', '.JPG', '.PNG', '.JPEG')
    
    files = [f for f in os.listdir(assets_dir) if f.lower().endswith(valid_exts)]
    print(f"Found {len(files)} images to optimize.")

    for filename in files:
        file_path = os.path.join(assets_dir, filename)
        
        # Determine output filename (always .webp)
        # We simplify extensions to avoid DSC_123.jpg.jpeg -> DSC_123.webp
        name_parts = filename.split('.')
        base_name = name_parts[0]
        output_name = f"{base_name}.webp"
        output_path = os.path.join(assets_dir, output_name)
        
        try:
            with Image.open(file_path) as img:
                # Convert RGBA to RGB if saving to WebP/JPEG to prevent errors
                if img.mode in ("RGBA", "P"):
                    img = img.convert("RGB")
                
                # Save as WebP with high quality but great compression
                img.save(output_path, "WEBP", quality=80, method=6)
                print(f"Optimized: {filename} -> {output_name} ({os.path.getsize(output_path)//1024}KB)")
                
                # Optional: Delete original if you want to save space immediately
                # os.remove(file_path)
                
        except Exception as e:
            print(f"Error processing {filename}: {e}")

if __name__ == "__main__":
    optimize_images("assets")

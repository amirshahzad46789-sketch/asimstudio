import re
import os

def update_references(file_path):
    if not os.path.exists(file_path):
        print(f"File {file_path} not found.")
        return

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Regex to find assets/... and replace extension with .webp
    # We target common image extensions
    # Pattern looks for assets/name.ext (handling spaces)
    pattern = r'assets/([^"\'\)]+)\.(jpeg|jpg|png|JPG|PNG|JPEG|jpg\.jpeg|JPG\.jpeg)'
    
    def replacer(match):
        full_match = match.group(0)
        # We take the first part before any dot in the filename
        # Assets/special 1.jpeg -> group(1) is 'special 1'
        # Assets/DSC_2777.JPG.jpeg -> group(1) might be 'DSC_2777.JPG' depending on regex
        # But optimize_images.py did split('.')[0]
        
        raw_name = match.group(1)
        base_name = raw_name.split('.')[0]
        return f'assets/{base_name}.webp'

    new_content = re.sub(pattern, replacer, content)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f"Updated references in {file_path}")

if __name__ == "__main__":
    update_references("index.html")
    update_references("script.js")

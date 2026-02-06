#!/usr/bin/env python3
"""
Script to convert all .webp files to .png in selected folders and their subdirectories.
Original .webp files are moved to a "webp archive" folder.
"""

import os
import sys
import shutil
from pathlib import Path
from PIL import Image


def find_webp_files(root_folders):
    """Recursively find all .webp files in the given folders."""
    webp_files = []
    for root_folder in root_folders:
        root_path = Path(root_folder).resolve()
        if not root_path.exists():
            print(f"Warning: Folder not found: {root_folder}")
            continue
        
        for webp_file in root_path.rglob("*.webp"):
            if webp_file.is_file():
                webp_files.append(webp_file)
    
    return webp_files


def convert_webp_to_png(webp_path):
    """Convert a .webp file to .png in the same location."""
    try:
        png_path = webp_path.with_suffix('.png')
        
        # Open and convert the image
        with Image.open(webp_path) as img:
            # Convert RGBA if needed, otherwise RGB
            if img.mode in ('RGBA', 'LA', 'P'):
                img = img.convert('RGBA')
            else:
                img = img.convert('RGB')
            
            # Resize to 512x512 if dimensions don't match
            target_size = (512, 512)
            if img.size != target_size:
                original_size = img.size
                img = img.resize(target_size, Image.LANCZOS)
                print(f"Resized: {webp_path.name} from {original_size[0]}x{original_size[1]} to {target_size[0]}x{target_size[1]}")
            
            # Save as PNG
            img.save(png_path, 'PNG')
        
        print(f"Converted: {webp_path.name} -> {png_path.name}")
        return True
    except Exception as e:
        print(f"Error converting {webp_path}: {e}")
        return False


def archive_webp_files(webp_files, root_folders):
    """Move all webp files to a collective 'webp archive' folder."""
    if not webp_files:
        return
    
    # Determine the archive location (parent of the highest level folder)
    first_root = Path(root_folders[0]).resolve()
    archive_dir = first_root.parent / "webp archive"
    
    # Create archive directory if it doesn't exist
    archive_dir.mkdir(exist_ok=True)
    
    # Move each webp file to the archive
    for webp_file in webp_files:
        try:
            # Create a unique name if there are conflicts
            dest_path = archive_dir / webp_file.name
            counter = 1
            original_stem = webp_file.stem
            
            while dest_path.exists():
                dest_path = archive_dir / f"{original_stem}_{counter}.webp"
                counter += 1
            
            shutil.move(str(webp_file), str(dest_path))
            print(f"Archived: {webp_file} -> {dest_path}")
        except Exception as e:
            print(f"Error archiving {webp_file}: {e}")


def find_emoji_png_files(root_folders):
    """Recursively find all .png files with 'emoji' in the filename."""
    png_files = []
    for root_folder in root_folders:
        root_path = Path(root_folder).resolve()
        if not root_path.exists():
            continue

        for png_file in root_path.rglob("*.png"):
            if png_file.is_file() and "emoji" in png_file.name.lower():
                png_files.append(png_file)

    return png_files


def resize_png_to_512(png_path):
    """Resize a PNG file to 512x512 if needed."""
    try:
        with Image.open(png_path) as img:
            target_size = (512, 512)
            if img.size == target_size:
                return False

            original_size = img.size
            if img.mode in ('RGBA', 'LA', 'P'):
                img = img.convert('RGBA')
            else:
                img = img.convert('RGB')

            img = img.resize(target_size, Image.LANCZOS)
            img.save(png_path, 'PNG')

        print(
            f"Resized emoji PNG: {png_path.name} "
            f"from {original_size[0]}x{original_size[1]} to {target_size[0]}x{target_size[1]}"
        )
        return True
    except Exception as e:
        print(f"Error resizing {png_path}: {e}")
        return False


def main():
    """Main function to process webp files."""
    print("=== WebP to PNG Converter ===\n")
    
    folders = []
    print("Enter folder paths to search for .webp files.")
    print("You can enter multiple folders, one at a time.")
    print("Press Enter with an empty path when done.\n")
    
    while True:
        folder_path = input(f"Folder {len(folders) + 1} (or press Enter to finish): ").strip()
        
        if not folder_path:
            if len(folders) == 0:
                print("No folders specified. Exiting.")
                sys.exit(0)
            break
        
        # Remove quotes if user added them
        folder_path = folder_path.strip('"').strip("'")
        
        # Check if the folder exists
        if not Path(folder_path).exists():
            print(f"  Warning: Folder not found: {folder_path}")
            retry = input("  Add it anyway? (y/n): ").strip().lower()
            if retry != 'y':
                continue
        
        folders.append(folder_path)
        print(f"  Added: {folder_path}\n")
    
    print(f"\nSearching for .webp files in {len(folders)} folder(s)...")
    webp_files = find_webp_files(folders)
    
    successful_conversions = []
    if not webp_files:
        print("No .webp files found.")
    else:
        print(f"\nFound {len(webp_files)} .webp file(s).")
        
        # Convert all webp files to png
        print("\n=== Converting files ===")
        for webp_file in webp_files:
            if convert_webp_to_png(webp_file):
                successful_conversions.append(webp_file)
        
        # Archive the original webp files
        print("\n=== Archiving original .webp files ===")
        archive_webp_files(successful_conversions, folders)
        
        print(f"\n✓ Complete! Converted {len(successful_conversions)} file(s).")
        print(f"  Original .webp files archived to: {Path(folders[0]).resolve().parent / 'webp archive'}")

    resize_prompt = input("\nDo you want to resize all pngs to 512x512? (y/n): ").strip().lower()
    if resize_prompt == 'y':
        print("\n=== Resizing emoji PNGs to 512x512 ===")
        emoji_pngs = find_emoji_png_files(folders)
        if not emoji_pngs:
            print("No emoji PNG files found.")
        else:
            resized_count = 0
            for png_file in emoji_pngs:
                if resize_png_to_512(png_file):
                    resized_count += 1
            print(f"\n✓ Emoji PNG resize complete! Resized {resized_count} file(s).")


if __name__ == "__main__":
    main()

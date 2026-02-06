#!/usr/bin/env python3
"""
Script to create folders with the nomenclature:
peacock_{game}_YYYY_MM_DD_{title}

Prompts user for:
- Start and end dates
- Game type selection
- Path to a txt file containing titles
"""

import os
import sys
from datetime import datetime, timedelta
from pathlib import Path


def get_date_input(prompt):
    """Get a valid date from the user."""
    while True:
        date_str = input(prompt).strip()
        try:
            date_obj = datetime.strptime(date_str, "%Y-%m-%d")
            return date_obj
        except ValueError:
            print("  Invalid format. Please use YYYY-MM-DD (e.g., 2026-01-27)")


def get_date_range():
    """Prompt user for start and end dates."""
    print("\n=== Date Range ===")
    print("Enter dates in YYYY-MM-DD format (e.g., 2026-01-27)\n")
    
    start_date = get_date_input("Start date: ")
    
    while True:
        end_date = get_date_input("End date: ")
        if end_date >= start_date:
            break
        print("  Error: End date must be on or after start date.")
    
    return start_date, end_date


def generate_date_list(start_date, end_date):
    """Generate a list of dates between start and end (inclusive)."""
    dates = []
    current_date = start_date
    
    while current_date <= end_date:
        dates.append(current_date)
        current_date += timedelta(days=1)
    
    return dates


def get_game_type():
    """Prompt user to select a game type."""
    print("\n=== Game Type Selection ===")
    
    game_types = [
        "basketball",
        "football",
        "baseball",
        "soccer",
        "hockey",
        "tennis",
        "golf",
        "other"
    ]
    
    print("Available game types:")
    for i, game in enumerate(game_types, 1):
        print(f"  {i}. {game}")
    
    while True:
        choice = input("\nSelect a game type (enter number or type custom name): ").strip()
        
        # Check if user entered a number
        if choice.isdigit():
            idx = int(choice) - 1
            if 0 <= idx < len(game_types):
                if game_types[idx] == "other":
                    custom = input("Enter custom game type: ").strip()
                    if custom:
                        return custom
                    continue
                return game_types[idx]
        
        # User typed a custom name
        if choice:
            return choice
        
        print("  Invalid selection. Please try again.")


def get_titles_from_file():
    """Prompt user for a txt file and read titles from it."""
    print("\n=== Titles File ===")
    
    while True:
        file_path = input("Enter path to titles txt file: ").strip()
        
        # Remove quotes if user added them
        file_path = file_path.strip('"').strip("'")
        
        path = Path(file_path)
        
        if not path.exists():
            print(f"  Error: File not found: {file_path}")
            retry = input("  Try again? (y/n): ").strip().lower()
            if retry != 'y':
                return []
            continue
        
        if not path.is_file():
            print(f"  Error: Not a file: {file_path}")
            continue
        
        try:
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read().strip()
            
            # Check if content contains commas - if so, treat as comma-separated
            if ',' in content:
                # Split by commas and strip whitespace from each title
                titles = [title.strip() for title in content.split(',') if title.strip()]
                print("  Detected comma-separated format.")
            else:
                # Split by line breaks and strip whitespace, skip empty lines
                titles = [line.strip() for line in content.split('\n') if line.strip()]
                print("  Detected line-separated format.")
            
            if not titles:
                print("  Warning: File is empty or contains no valid titles.")
                retry = input("  Try a different file? (y/n): ").strip().lower()
                if retry == 'y':
                    continue
                return []
            
            print(f"  Found {len(titles)} title(s) in file.")
            return titles
        
        except Exception as e:
            print(f"  Error reading file: {e}")
            retry = input("  Try again? (y/n): ").strip().lower()
            if retry != 'y':
                return []


def sanitize_folder_name(name):
    """Remove or replace characters that are invalid in folder names."""
    # Replace common problematic characters
    replacements = {
        '/': '-',
        '\\': '-',
        ':': '-',
        '*': '',
        '?': '',
        '"': '',
        '<': '',
        '>': '',
        '|': '-'
    }
    
    for old, new in replacements.items():
        name = name.replace(old, new)
    
    # Remove leading/trailing spaces and periods
    name = name.strip('. ')
    
    return name


def create_folders(dates, game_type, titles, output_dir=None):
    """Create folders by pairing dates with titles sequentially."""
    if output_dir is None:
        output_dir = Path.cwd()
    else:
        output_dir = Path(output_dir)
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    created_count = 0
    skipped_count = 0
    
    print(f"\n=== Creating Folders ===")
    print(f"Output directory: {output_dir}\n")
    
    # Pair dates with titles sequentially
    for i, (date, title) in enumerate(zip(dates, titles)):
        date_str = date.strftime("%Y_%m_%d")
        
        # Sanitize the title for use in folder name
        clean_title = sanitize_folder_name(title)
        
        # Create folder name
        folder_name = f"peacock_{game_type}_{date_str}_{clean_title}"
        folder_path = output_dir / folder_name
        
        try:
            if folder_path.exists():
                print(f"  Skipped (exists): {folder_name}")
                skipped_count += 1
            else:
                folder_path.mkdir(parents=True, exist_ok=True)
                print(f"  Created: {folder_name}")
                created_count += 1
        except Exception as e:
            print(f"  Error creating {folder_name}: {e}")
    
    return created_count, skipped_count


def main():
    """Main function."""
    print("=== Peacock Folder Generator ===")
    print("This script creates folders with the format:")
    print("peacock_{game}_{YYYY_MM_DD}_{title}\n")
    
    # Get date range
    start_date, end_date = get_date_range()
    dates = generate_date_list(start_date, end_date)
    print(f"  → Will create folders for {len(dates)} date(s)")
    
    # Get game type
    game_type = get_game_type()
    print(f"  → Selected game: {game_type}")
    
    # Get titles
    titles = get_titles_from_file()
    if not titles:
        print("\nNo titles provided. Exiting.")
        sys.exit(0)
    
    # Check if dates and titles counts match
    num_dates = len(dates)
    num_titles = len(titles)
    total_folders = min(num_dates, num_titles)
    
    print(f"\n→ Will create {total_folders} folder(s)")
    print(f"  (Pairing {num_dates} date(s) with {num_titles} title(s))")
    
    if num_dates != num_titles:
        print(f"  ⚠ Warning: Counts don't match. Only the first {total_folders} will be paired.")
        if num_dates > num_titles:
            print(f"    {num_dates - num_titles} date(s) will be unused.")
        else:
            print(f"    {num_titles - num_dates} title(s) will be unused.")
    
    # Ask for confirmation
    confirm = input("\nProceed with folder creation? (y/n): ").strip().lower()
    if confirm != 'y':
        print("Cancelled.")
        sys.exit(0)
    
    # Optional: ask for output directory
    use_custom_dir = input("\nCreate in current directory? (y/n): ").strip().lower()
    output_dir = None
    
    if use_custom_dir != 'y':
        custom_path = input("Enter output directory path: ").strip().strip('"').strip("'")
        if custom_path:
            output_dir = custom_path
    
    # Create folders
    created, skipped = create_folders(dates, game_type, titles, output_dir)
    
    print(f"\n✓ Complete!")
    print(f"  Created: {created} folder(s)")
    print(f"  Skipped: {skipped} folder(s) (already existed)")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Import recipes from text file into JSON files.
Usage: python -X utf8 scripts/import_recipes.py
"""

import json
import re
import sys
from pathlib import Path

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
INPUT_FILE = Path(r"C:\Users\dror\AppData\Local\Temp\recipes_text.txt")
OUTPUT_DIR = PROJECT_DIR / "data" / "recipes"

# Category mapping
CATEGORY_MAP = {
    "בצקים ולחמים": "מאפים",
    "עוגות וקינוחים": "עוגות",
    "עוגיות וממתקים": "עוגיות",
    "מאפים מלוחים ופשטידות": "פשטידות",
    "סלטים, ירקות ומטבלים": "סלטים",
    "מרקים": "מרקים",
    "מנות בשר ועוף": "בשר",
    "דגים": "דגים",
    "ריבות, רטבים וקונפיטורות": "ריבות ומטבלים",
}

# Headers that introduce ingredient sections (must end with colon or be a known keyword)
INGREDIENT_HEADERS = re.compile(
    r"^(חומרים|בצק|מילוי|תערובת|לסירופ|לבצק|למילוי|לרוטב|רוטב|ציפוי|קרם|תוספת|סירופ"
    r"|חומרים\s+ל[^\n]*|חומרים\s+למילוי|חומרים\s+לבצק|מילוי\s+\d+)\s*:\s*$",
    re.UNICODE,
)

# Headers that start the instructions section
INSTRUCTION_HEADERS = re.compile(
    r"^אופן\s+(הכנה|ההכנה)\s*:\s*$",
    re.UNICODE,
)

# Chapter header pattern
CHAPTER_PATTERN = re.compile(r"^פרק\s+\d+\s*$")

# Numbered step pattern: "1. " or "1) " at start
STEP_PATTERN = re.compile(r"^\d+[\.\)]\s")


def slugify(title: str) -> str:
    """Create a URL-safe slug from a Hebrew title."""
    slug = title.strip()
    slug = slug.replace(" ", "-")
    slug = re.sub(r"[^\u0590-\u05FF\w\-]", "", slug, flags=re.UNICODE)
    slug = re.sub(r"-+", "-", slug)
    slug = slug.strip("-")
    slug = slug.lower()
    return slug + "-imported"


def is_page_number(s: str) -> bool:
    return bool(re.match(r"^\d+$", s))


def clean_ingredient(s: str) -> str:
    s = re.sub(r"^[•·\-–—]\s*", "", s)
    return s.strip()


def prev_line_is_open(prev: str) -> bool:
    """
    True if the previous line ended mid-sentence (no closing punctuation),
    suggesting the current line is its continuation.
    Common endings for mid-sentence lines: no period, no colon at end,
    or ends with a comma / open paren / specific continuation patterns.
    """
    if not prev:
        return False
    # Line ends without terminal punctuation (. ! ?) → likely wraps to next line
    last_char = prev.rstrip()[-1] if prev.rstrip() else ""
    if last_char not in ".!?:":
        return True
    return False


def get_next_nonblank(lines: list[str], start: int) -> tuple[int, str]:
    """Return (index, stripped_text) of next non-empty/non-❦/non-page-number line."""
    for j in range(start, len(lines)):
        s = lines[j].strip()
        if s and s != "❦" and not is_page_number(s):
            return j, s
    return len(lines), ""


def is_recipe_title(s: str, prev_raw: str, next_s: str) -> bool:
    """
    Decide if a line is a recipe title.
    Must NOT be:
      - chapter/ingredient/instruction header
      - bullet line
      - numbered step
      - standalone page number
      - footnote (starts with *)
      - continuation of previous line (prev ended without terminal punct)
      - a line that follows a numbered step without terminal punct (continuation)
    """
    if not s or s == "❦":
        return False
    if CHAPTER_PATTERN.match(s):
        return False
    if INGREDIENT_HEADERS.match(s):
        return False
    if INSTRUCTION_HEADERS.match(s):
        return False
    if s.startswith("•"):
        return False
    if STEP_PATTERN.match(s):
        return False
    if is_page_number(s):
        return False
    # Footnotes / parenthetical notes
    if s.startswith("*"):
        return False
    # Very long lines are likely instructions/continuations, not titles
    if len(s) > 60:
        return False
    # If previous line ended without terminal punctuation, this is a continuation
    if prev_line_is_open(prev_raw):
        return False

    # Lookahead: the line following a recipe title should be one of:
    #   - an ingredient header, a bullet, another plain ingredient, or an instruction header
    #   - another potential recipe title (rare but happens)
    #   - a chapter header
    # If next line looks like a continuation of instruction (numbered step, plain Hebrew text
    # that doesn't start a recipe), we may be mid-instruction.
    # We trust the previous-line check more than lookahead here.

    # Additional heuristic: a title should not start with common instruction verbs
    # that indicate it's a continuation phrase
    continuation_starters = (
        "ולאחר", "ומעבירים", "ומוסיפים", "ולהוסיף", "ולטבול",
        "ולהשהות", "ולהניח", "ומשאירים", "ומחזירים", "ולבשל",
        "ולאפות", "ולטגן", "ולערבב", "ולצקת", "ומגישים",
    )
    for starter in continuation_starters:
        if s.startswith(starter):
            return False

    return True


def parse_recipes(lines: list[str]) -> list[dict]:
    """Parse all recipes from the content lines (after TOC)."""
    stripped = [l.rstrip("\n").rstrip() for l in lines]
    n = len(stripped)
    recipes = []
    current_category: str | None = None

    i = 0
    while i < n:
        s = stripped[i].strip()

        # Chapter header
        if CHAPTER_PATTERN.match(s):
            i += 1
            while i < n and not stripped[i].strip():
                i += 1
            if i < n:
                cat_raw = stripped[i].strip()
                current_category = CATEGORY_MAP.get(cat_raw, cat_raw)
            i += 1
            while i < n and stripped[i].strip() in ("❦", ""):
                i += 1
            continue

        # Skip noise
        if not s or s == "❦" or is_page_number(s):
            i += 1
            continue

        # Skip if no category yet (pre-chapter content)
        if current_category is None:
            i += 1
            continue

        # Check for recipe title
        prev_raw = stripped[i - 1] if i > 0 else ""
        _, next_s = get_next_nonblank(stripped, i + 1)

        if not is_recipe_title(s, prev_raw, next_s):
            i += 1
            continue

        # ---- Recipe title found ----
        recipe_title = s
        ingredients: list[str] = []
        instruction_parts: list[str] = []
        in_ingredients = False
        in_instructions = False
        last_nonempty = s  # track last non-empty line for continuation detection

        i += 1

        while i < n:
            rline = stripped[i]
            rs = rline.strip()

            # Stop at chapter
            if CHAPTER_PATTERN.match(rs):
                break

            # Skip empty / ❦
            if not rs or rs == "❦":
                i += 1
                continue

            # Skip page numbers
            if is_page_number(rs):
                i += 1
                continue

            # Instruction header
            if INSTRUCTION_HEADERS.match(rs):
                in_ingredients = False
                in_instructions = True
                last_nonempty = rs
                i += 1
                continue

            # Ingredient section header
            if INGREDIENT_HEADERS.match(rs):
                # Special case: "למשיחת העוף: להגשה:" etc. that have colons
                # but are actually sub-labels within a recipe - treat as ingredient header
                in_ingredients = True
                in_instructions = False
                last_nonempty = rs
                i += 1
                continue

            # If we are in instructions:
            if in_instructions:
                # Check if this is a new recipe title (to stop collecting)
                _, next_s2 = get_next_nonblank(stripped, i + 1)
                if is_recipe_title(rs, last_nonempty, next_s2) and not prev_line_is_open(last_nonempty):
                    break
                # Footnote/note lines within instructions: include in instructions
                if rs.startswith("*"):
                    instruction_parts.append(rs)
                    last_nonempty = rs
                    i += 1
                    continue
                # Otherwise it's part of instructions
                instruction_parts.append(rs)
                last_nonempty = rs
                i += 1
                continue

            # In ingredients mode or bullet lines
            if in_ingredients or rs.startswith("•"):
                # But check if this might be a new recipe title
                _, next_s2 = get_next_nonblank(stripped, i + 1)
                if not rs.startswith("•") and is_recipe_title(rs, last_nonempty, next_s2):
                    break
                cleaned = clean_ingredient(rs)
                if cleaned:
                    ingredients.append(cleaned)
                last_nonempty = rs
                i += 1
                continue

            # Not in any explicit mode yet
            if STEP_PATTERN.match(rs):
                in_instructions = True
                instruction_parts.append(rs)
                last_nonempty = rs
                i += 1
                continue

            # Check if it's a new recipe title
            _, next_s2 = get_next_nonblank(stripped, i + 1)
            if is_recipe_title(rs, last_nonempty, next_s2):
                break

            # Treat as plain ingredient (no bullet, no header, not a step)
            # But skip footnotes/notes
            if rs.startswith("*"):
                last_nonempty = rs
                i += 1
                continue

            cleaned = clean_ingredient(rs)
            if cleaned:
                ingredients.append(cleaned)
            last_nonempty = rs
            i += 1

        instructions = " ".join(instruction_parts).strip()
        recipe = {
            "id": slugify(recipe_title),
            "title": recipe_title,
            "category": current_category,
            "ingredients": ingredients,
            "instructions": instructions,
            "audioUrl": None,
            "createdAt": "2026-04-10T00:00:00.000Z",
        }
        recipes.append(recipe)

    return recipes


def main():
    print(f"Reading {INPUT_FILE}...", file=sys.stderr)
    with open(INPUT_FILE, encoding="utf-8") as f:
        all_lines = f.readlines()

    print(f"Total lines: {len(all_lines)}", file=sys.stderr)

    # Skip TOC (lines 1-114, indices 0-113)
    content_lines = all_lines[114:]
    print(f"Content lines (after TOC): {len(content_lines)}", file=sys.stderr)

    recipes = parse_recipes(content_lines)
    print(f"Parsed {len(recipes)} recipes", file=sys.stderr)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Clear existing files
    for f in OUTPUT_DIR.glob("*.json"):
        f.unlink()

    seen_slugs: dict[str, int] = {}
    saved = 0

    for recipe in recipes:
        slug = recipe["id"]
        if slug in seen_slugs:
            seen_slugs[slug] += 1
            new_slug = f"{slug}-{seen_slugs[slug]}"
            recipe["id"] = new_slug
            slug = new_slug
        else:
            seen_slugs[slug] = 1

        out_path = OUTPUT_DIR / f"{slug}.json"
        with open(out_path, "w", encoding="utf-8") as fout:
            json.dump(recipe, fout, ensure_ascii=False, indent=2)
        saved += 1

    print(f"\nSaved {saved} recipe JSON files to {OUTPUT_DIR}", file=sys.stderr)
    print(saved)
    return saved


if __name__ == "__main__":
    main()

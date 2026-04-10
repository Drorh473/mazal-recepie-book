# -*- coding: utf-8 -*-
"""
Comprehensive test suite for Mazal Recipe Book app.
Tests: homepage, upload page, responsive design, upload zone, voice recorder.
"""
import sys
import os
import tempfile

# Force UTF-8 output on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

from playwright.sync_api import sync_playwright

PASS = []
FAIL = []

def check(name, condition, detail=""):
    if condition:
        PASS.append(name)
        print(f"  OK  {name}")
    else:
        FAIL.append(name)
        print(f"  FAIL  {name}" + (f" -- {detail}" if detail else ""))

def count(locator):
    return locator.count()

def visible(locator):
    """Safe visibility check using first match."""
    return locator.first.is_visible() if locator.count() > 0 else False

def test_homepage(page):
    print("\n--- Homepage (/)")
    page.goto("http://localhost:3000")
    page.wait_for_load_state("networkidle")

    check("H1 title visible", page.locator("h1").first.is_visible())
    check("Recipe count area visible", visible(page.locator("text=מתכונים")))
    check("Upload link in nav", page.locator("a[href='/upload']").first.is_visible())
    check("Home link in nav", page.locator("a[href='/']").first.is_visible())

    # All 10 category tabs
    categories = ["סלטים", "דגים", "בשר", "פשטידות", "עוגות", "עוגיות", "חגים", "מרקים", "מאפים"]
    for cat in categories:
        check(f"Category tab: {cat}", visible(page.locator(f"button:has-text('{cat}')")))


def test_upload_page(page):
    print("\n--- Upload Page (/upload)")
    page.goto("http://localhost:3000/upload")
    page.wait_for_load_state("networkidle")

    check("Upload heading", visible(page.locator("h1")))
    check("Voice recorder section", visible(page.locator("text=הקלטת מתכון בקול")))
    check("Record button", visible(page.locator("button:has-text('הקלטה')")))
    check("OR divider", visible(page.locator("text=או")))

    # File inputs
    file_inputs = page.locator("input[type='file']").all()
    check("File input exists", len(file_inputs) > 0, f"found {len(file_inputs)}")

    has_dir = any(inp.get_attribute("webkitdirectory") is not None for inp in file_inputs)
    check("Folder upload (webkitdirectory)", has_dir)

    has_image_accept = any(
        "image" in (inp.get_attribute("accept") or "")
        for inp in file_inputs
    )
    check("Image accept attribute", has_image_accept)

    # RTL direction
    dir_attr = page.locator("html").get_attribute("dir")
    check("RTL direction set", dir_attr == "rtl", f"dir='{dir_attr}'")


def test_responsive(page):
    print("\n--- Responsive Design")

    viewports = [
        ("Mobile 375px", 375, 667),
        ("Tablet 768px", 768, 1024),
        ("Desktop 1280px", 1280, 800),
    ]

    for label, w, h in viewports:
        page.set_viewport_size({"width": w, "height": h})

        page.goto("http://localhost:3000")
        page.wait_for_load_state("networkidle")
        check(f"{label} - homepage h1 visible", page.locator("h1").first.is_visible())

        page.goto("http://localhost:3000/upload")
        page.wait_for_load_state("networkidle")
        check(f"{label} - upload h1 visible", page.locator("h1").first.is_visible())

        scroll_w = page.evaluate("document.documentElement.scrollWidth")
        check(f"{label} - no horizontal overflow", scroll_w <= w + 5, f"scrollWidth={scroll_w}")


def test_upload_interaction(page):
    print("\n--- Image Upload Interaction")
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto("http://localhost:3000/upload")
    page.wait_for_load_state("networkidle")

    errors = []
    page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)

    file_input = page.locator("input[type='file']").first
    check("File input not disabled", not file_input.is_disabled())

    # Create a minimal 1x1 PNG
    png_bytes = bytes([
        0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,
        0x00,0x00,0x00,0x0d,0x49,0x48,0x44,0x52,
        0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x01,
        0x08,0x02,0x00,0x00,0x00,0x90,0x77,0x53,
        0xde,0x00,0x00,0x00,0x0c,0x49,0x44,0x41,
        0x54,0x08,0xd7,0x63,0xf8,0xcf,0xc0,0x00,
        0x00,0x00,0x02,0x00,0x01,0xe2,0x21,0xbc,
        0x33,0x00,0x00,0x00,0x00,0x49,0x45,0x4e,
        0x44,0xae,0x42,0x60,0x82
    ])
    tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
    tmp.write(png_bytes)
    tmp.close()

    try:
        file_input.set_input_files(tmp.name)
        page.wait_for_timeout(2000)

        is_processing = visible(page.locator("text=Claude"))
        has_error = visible(page.locator("text=שגיאה")) or visible(page.locator("text=Claude אינו זמין"))
        check("File upload triggers state change", is_processing or has_error,
              "stage did not change after file selection")
    finally:
        try:
            os.unlink(tmp.name)
        except PermissionError:
            pass  # Windows: file still locked briefly, harmless

    check("No JS errors during upload", len(errors) == 0, "; ".join(errors[:3]))


def test_voice_recorder(page):
    print("\n--- Voice Recorder")
    page.goto("http://localhost:3000/upload")
    page.wait_for_load_state("networkidle")

    errors = []
    page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)

    record_btn = page.locator("button:has-text('הקלטה')")
    check("Record button present", record_btn.count() > 0)
    check("Record button not disabled", not record_btn.first.is_disabled())

    # Click and wait — without mic it may fail gracefully
    record_btn.first.click()
    page.wait_for_timeout(1500)

    stop_visible = visible(page.locator("button:has-text('עצור')"))
    record_still = visible(page.locator("button:has-text('הקלטה')"))
    check("Recorder click doesn't crash page", stop_visible or record_still,
          "neither stop nor record button visible after click")

    check("No JS errors from recorder", len(errors) == 0, "; ".join(errors[:3]))


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(permissions=["microphone"])
        page = context.new_page()

        test_homepage(page)
        test_upload_page(page)
        test_responsive(page)
        test_upload_interaction(page)
        test_voice_recorder(page)

        browser.close()

    print(f"\n{'='*50}")
    print(f"Results: {len(PASS)} passed, {len(FAIL)} failed")
    if FAIL:
        print("\nFailed:")
        for f in FAIL:
            print(f"  FAIL  {f}")
        sys.exit(1)
    else:
        print("All tests passed!")


if __name__ == "__main__":
    main()

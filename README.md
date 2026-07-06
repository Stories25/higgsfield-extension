# Higgsfield Prompt Extender Chrome Extension

A sleek Chrome extension that optimizes the video prompt box and settings sidebar on **Higgsfield AI** (`https://higgsfield.ai/ai/video`). It introduces key layout upgrades:
1. **Vertical Resizing**: Drag the bottom edge of the prompt box to extend its height in the sidebar layout.
2. **In-place Height Toggle**: Click the vertical double chevron toggle button (`︾` / `︽`) in the top-right of the prompt box to toggle height between `160px` and `450px` fluidly.
3. **Horizontal Sidebar Resizing**: Drag the right edge of the settings sidebar horizontally to size it anywhere from `320px` to `800px` dynamically with absolute smoothness.
4. **Width Preference Persistence**: Remembers your preferred sidebar width dynamically in `localStorage` across page reloads.
5. **Horizontal Sidebar Width Toggle**: Click the horizontal double chevron toggle button (`>>` / `<<`) next to the height toggle to expand the sidebar to `600px` instantly, or collapse it back to default.

---

## 📂 File Structure

* `manifest.json` - Defines the extension metadata, matches the URL patterns, and registers script assets.
* `content.js` - Dynamically monitors and injects the expand/collapse toggling into Higgsfield's Lexical text editor.
* `content.css` - Custom styling overrides, flex overrides, and beautiful height transition animations matching Higgsfield's brand design.

---

## 🛠️ Installation Instructions

1. Open Google Chrome.
2. In the URL bar, go to: `chrome://extensions/`
3. Toggle the **"Developer mode"** switch on the top right.
4. Click the **"Load unpacked"** button on the top left.
5. Select the project folder:
   `/Users/samirpatil/Desktop/Dev/higgsfield-prompt-extension`
6. Navigate to `https://higgsfield.ai/ai/video` (or reload the page if it's already open).

---

## 💡 How to Use

* **Vertical Height Toggle**: Click the double chevron down (`︾`) icon in the top-right corner of the prompt box to expand it to `450px` in-place. Click the double chevron up (`︽`) icon to collapse it.
* **Vertical Manual Drag**: Hover over the bottom edge of the prompt box and drag vertically to adjust height manually.
* **Horizontal Width Toggle**: Click the double chevron right (`>>`) icon next to the height toggle in the prompt box to expand the sidebar to `600px`. Click it again (`<<`) to restore it.
* **Horizontal Manual Drag**: Hover over the right edge of the settings sidebar (a green highlight bar will appear on hover) and drag horizontally to resize from `320px` to `800px` freely.



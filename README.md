# Higgsfield Prompt Extender Chrome Extension

A sleek Chrome extension that optimizes the video prompt box on **Higgsfield AI** (`https://higgsfield.ai/ai/video`). It introduces two major upgrades:
1. **Vertical Resizing**: Drag the bottom corner of the prompt box to extend its height in the sidebar layout.
2. **In-place Height Toggle**: Click the "Double Chevron" toggle button at the top right of the prompt box to expand/collapse the box height in-place between `160px` and `450px` fluidly.

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

* **Resize in Sidebar**: Hover over the bottom edge of the prompt box in the left sidebar and drag down to resize.
* **In-place Expand**: Hover over the prompt input and click the double chevron down (`︾`) icon in the top-right corner. It will expand fluidly to `450px` in-place, pushing elements down and giving you ample space.
* **In-place Collapse**: Click the double chevron up (`︽`) icon to return to the standard sidebar view.


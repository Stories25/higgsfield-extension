# Higgsfield Prompt Extender & Batch Generator Chrome Extension

A sleek Chrome extension that optimizes the video prompt box and settings sidebar on **Higgsfield AI** (`https://higgsfield.ai/ai/video`) and automates batch video generation sequentially.

## 🚀 Key Features

### 1. Batch Video Automation (New)
* **Sequential Queue Processing**: Automatically processes multiple text prompts one at a time.
* **Consistent Settings**: Configures Model, Duration (4–15s), Resolution (480p, 720p, 1080p), Aspect Ratio, and Bitrate once to run across all items.
* **Interactive Control Dashboard**: Start, pause, or reset batch generations directly from the premium extension popup.
* **Real-time Event Logging**: Live progress bar updates and color-coded console logging (waiting, submitting, generating, completed, warnings, errors).
* **Robust Safety Checks**: Detects out-of-credit status, skips policy-flagged/NSFW prompts, handles page navigation delays, and handles target tab closure gracefully.

### 2. Layout Upgrades
* **Vertical Resizing**: Drag the bottom edge of the prompt box to extend its height in the sidebar layout.
* **In-place Height Toggle**: Click the vertical double chevron toggle button (`︾` / `︽`) in the top-right of the prompt box to toggle height between `160px` and `450px` fluidly.
* **Horizontal Sidebar Resizing**: Drag the right edge of the settings sidebar horizontally to size it anywhere from `320px` to `800px` dynamically with absolute smoothness.
* **Width Preference Persistence**: Remembers your preferred sidebar width dynamically in `localStorage` across page reloads.
* **Horizontal Sidebar Width Toggle**: Click the horizontal double chevron toggle button (`>>` / `<<`) next to the height toggle to expand the sidebar to `600px` instantly, or collapse it back to default.

---

## 📂 File Structure

* `manifest.json` - Defines the extension metadata, V3 action popups, permissions, background workers, and injected assets.
* `background.js` - Service worker managing execution state, tab lifecycle hooks, and generation scheduling.
* `content.js` - Exposes `__higgsfieldBridge` on the DOM to control Lexical text entry, dropdown changes, sliders, and injects sidebar resizing buttons.
* `content.css` - Custom styling overrides, flex overrides, and beautiful height transition animations matching Higgsfield's brand design.
* `popup.html` & `popup.js` & `styles.css` - Premium dark-themed user interface dashboard for batch control.
* `icons/` - High-definition extension brand icons.

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

### Batch Video Generation
1. Click the **Higgsfield Batch Generator** extension icon in your Chrome toolbar.
2. Paste a list of text prompts (one prompt per line) in the text area. Lines starting with `#` or `//` are treated as comments and skipped automatically.
3. Toggle **Edit Settings** if you wish to adjust the Model, Duration, Resolution, Aspect Ratio, or Bitrate, and click **Save Settings**.
4. Click **Start Batch**. The extension will open/attach to the Higgsfield tab, navigate to the creation page, and begin auto-submitting the prompts.
5. Use **Pause** or **Stop/Reset** buttons to control active generation.

### Layout Adjustment
* **Vertical Height Toggle**: Click the double chevron down (`︾`) icon in the top-right corner of the prompt box to expand it to `450px` in-place. Click the double chevron up (`︽`) icon to collapse it.
* **Vertical Manual Drag**: Hover over the bottom edge of the prompt box and drag vertically to adjust height manually.
* **Horizontal Width Toggle**: Click the double chevron right (`>>`) icon next to the height toggle in the prompt box to expand the sidebar to `600px`. Click it again (`<<`) to restore it.
* **Horizontal Manual Drag**: Hover over the right edge of the settings sidebar (a green highlight bar will appear on hover) and drag horizontally to resize from `320px` to `800px` freely.

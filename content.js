(function () {
  'use strict';

  // Find the sidebar container ancestor of the prompt editor
  function getSidebar() {
    const editor = document.querySelector('div[data-lexical-editor="true"][role="textbox"]');
    if (editor) {
      let current = editor;
      while (current && current !== document.body) {
        if (current.classList.contains('w-[380px]') || 
            current.className.includes('w-[380px]') ||
            (current.classList.contains('border-r') && current.classList.contains('shrink-0'))) {
          return current;
        }
        current = current.parentElement;
      }
    }
    return document.querySelector('div.w-\\[380px\\]') || 
           document.querySelector('div[class*="w-[380px]"]') ||
           document.querySelector('.generate-form')?.parentElement;
  }

  // Setup/Update styling and injection on the prompt container and sidebar
  function setupExtension() {
    const editor = document.querySelector('div[data-lexical-editor="true"][role="textbox"]');
    if (!editor) return;

    const parent1 = editor.parentElement; // Immediate Container
    const parent2 = parent1?.parentElement; // Size Constraint Wrapper (.max-h-64)

    if (!parent2) return;

    // Apply main wrapper class if not already set
    if (!parent2.classList.contains('higgsfield-prompt-wrapper')) {
      parent2.classList.add('higgsfield-prompt-wrapper');
    }

    const sidebar = getSidebar();

    // Icons definitions
    const expandIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 13 12 18 17 13"></polyline><polyline points="7 6 12 11 17 6"></polyline></svg>`;
    const collapseIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 11 12 6 7 11"></polyline><polyline points="17 18 12 13 7 18"></polyline></svg>`;
    
    const expandWidthIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="13 17 18 12 13 7"></polyline><polyline points="6 17 11 12 6 7"></polyline></svg>`;
    const collapseWidthIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="11 17 6 12 11 7"></polyline><polyline points="18 17 13 12 18 7"></polyline></svg>`;

    // 1. Manage Sidebar Resizing & Restoring Width
    if (sidebar) {
      // Restore saved width if present
      const savedWidth = localStorage.getItem('higgsfield-sidebar-width');
      if (savedWidth) {
        sidebar.style.setProperty('width', savedWidth, 'important');
        sidebar.style.setProperty('flex-basis', savedWidth, 'important');
      }

      // Inject resizer handle if not already present
      if (!sidebar.querySelector('.higgsfield-sidebar-resizer')) {
        const resizer = document.createElement('div');
        resizer.className = 'higgsfield-sidebar-resizer';
        sidebar.appendChild(resizer);

        // Ensure relative positioning context
        if (window.getComputedStyle(sidebar).position === 'static') {
          sidebar.style.position = 'relative';
        }

        resizer.addEventListener('mousedown', (e) => {
          e.preventDefault();
          const startX = e.clientX;
          const startWidth = sidebar.getBoundingClientRect().width;

          document.body.classList.add('higgsfield-resizing');

          const onMouseMove = (moveEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const newWidth = Math.max(320, Math.min(800, startWidth + deltaX));
            sidebar.style.setProperty('width', `${newWidth}px`, 'important');
            sidebar.style.setProperty('flex-basis', `${newWidth}px`, 'important');
            localStorage.setItem('higgsfield-sidebar-width', `${newWidth}px`);
          };

          const onMouseUp = () => {
            document.body.classList.remove('higgsfield-resizing');
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);

            // Sync the width button's chevron direction after drag ends
            const widthBtn = parent2.querySelector('.higgsfield-sidebar-expand-btn');
            if (widthBtn) {
              const currentWidth = sidebar.getBoundingClientRect().width;
              widthBtn.innerHTML = (currentWidth >= 500) ? collapseWidthIcon : expandWidthIcon;
            }
          };

          window.addEventListener('mousemove', onMouseMove);
          window.addEventListener('mouseup', onMouseUp);
        });
      }
    }

    // 2. Inject Prompt Height Expand button if it doesn't exist yet
    if (!parent2.querySelector('.higgsfield-prompt-expand-btn')) {
      const expandBtn = document.createElement('button');
      expandBtn.className = 'higgsfield-prompt-expand-btn';
      expandBtn.setAttribute('title', 'Toggle Expanded View');
      expandBtn.setAttribute('type', 'button');

      expandBtn.innerHTML = expandIcon;
      parent2.appendChild(expandBtn);

      let isExpanded = false;

      expandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        isExpanded = !isExpanded;
        if (isExpanded) {
          parent2.classList.add('expanded');
          expandBtn.innerHTML = collapseIcon;
        } else {
          parent2.classList.remove('expanded');
          expandBtn.innerHTML = expandIcon;
          parent2.style.height = '';
        }
      });
    }

    // 3. Inject Sidebar Width Expand button if it doesn't exist yet
    if (!parent2.querySelector('.higgsfield-sidebar-expand-btn')) {
      const widthBtn = document.createElement('button');
      widthBtn.className = 'higgsfield-sidebar-expand-btn';
      widthBtn.setAttribute('title', 'Toggle Sidebar Width');
      widthBtn.setAttribute('type', 'button');

      // Initialize the button chevron direction based on current width
      const currentWidth = sidebar ? sidebar.getBoundingClientRect().width : 380;
      widthBtn.innerHTML = (currentWidth >= 500) ? collapseWidthIcon : expandWidthIcon;
      parent2.appendChild(widthBtn);

      widthBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const activeSidebar = getSidebar();
        if (!activeSidebar) return;

        const widthNow = activeSidebar.getBoundingClientRect().width;
        const isCurrentlyExpanded = widthNow >= 500;

        if (!isCurrentlyExpanded) {
          activeSidebar.style.setProperty('width', '600px', 'important');
          activeSidebar.style.setProperty('flex-basis', '600px', 'important');
          widthBtn.innerHTML = collapseWidthIcon;
          localStorage.setItem('higgsfield-sidebar-width', '600px');
        } else {
          activeSidebar.style.removeProperty('width');
          activeSidebar.style.removeProperty('flex-basis');
          widthBtn.innerHTML = expandWidthIcon;
          localStorage.removeItem('higgsfield-sidebar-width');
        }

        // Delay checking final width to match CSS transition
        setTimeout(() => {
          const sidebarAfter = getSidebar();
          if (sidebarAfter) {
            const widthAfter = sidebarAfter.getBoundingClientRect().width;
            widthBtn.innerHTML = (widthAfter >= 500) ? collapseWidthIcon : expandWidthIcon;
          }
        }, 350);
      });
    }
  }

  // ==========================================
  // BATCH VIDEO GENERATION AUTOMATION SECTION
  // ==========================================

  // Helper: Find element by text content or ARIA attributes
  function findButtonByText(text) {
    const sidebar = getSidebar();
    const buttons = Array.from(document.querySelectorAll('button, div[role="button"], span[role="button"]')).filter(btn => {
      if (sidebar && sidebar.contains(btn)) return true;
      const rect = btn.getBoundingClientRect();
      return rect.left < 850 && rect.top > 90;
    });
    for (const btn of buttons) {
      const btnText = btn.textContent?.trim().toLowerCase() || '';
      const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
      const title = (btn.getAttribute('title') || '').toLowerCase();
      if (btnText.includes(text.toLowerCase()) || 
          ariaLabel.includes(text.toLowerCase()) || 
          title.includes(text.toLowerCase())) {
        return btn;
      }
    }
    return null;
  }

  // Helper: Find dropdown/settings control button relative to its text label
  function findButtonNearLabel(labelText) {
    const sidebar = getSidebar();
    const elements = Array.from(document.querySelectorAll('div, span, label, p, h1, h2, h3, h4, h5, h6'));
    
    // Filter to elements inside the creation panel
    const candidates = elements.filter(el => {
      if (sidebar && sidebar.contains(el)) return true;
      const rect = el.getBoundingClientRect();
      return rect.left < 850 && rect.top > 90;
    });

    const matchingLabels = candidates.filter(el => {
      const text = el.textContent?.trim().toLowerCase() || '';
      return text === labelText.toLowerCase() || text.includes(labelText.toLowerCase());
    });

    for (const label of matchingLabels) {
      let current = label;
      // Search up to 3 parent levels for a button or sibling button
      for (let i = 0; i < 3; i++) {
        if (!current) break;
        const btn = current.querySelector('button, [role="button"]');
        if (btn) return btn;
        
        let sibling = current.nextElementSibling;
        while (sibling) {
          if (sibling.tagName === 'BUTTON' || sibling.getAttribute('role') === 'button') {
            return sibling;
          }
          const subBtn = sibling.querySelector('button, [role="button"]');
          if (subBtn) return subBtn;
          sibling = sibling.nextElementSibling;
        }
        current = current.parentElement;
      }
    }
    return null;
  }

  // Helper: Find and click dropdown list/menu option
  async function selectDropdownOption(buttonText, optionText) {
    let btn = findButtonByText(buttonText);
    if (!btn) {
      btn = findButtonNearLabel(buttonText);
    }

    if (!btn) {
      // Fallback: search for buttons carrying current option states (like "720p", "High", or "Enhanced")
      // Scoped only to the left creation panel to avoid clicking history cards
      const sidebar = getSidebar();
      const allButtons = Array.from(document.querySelectorAll('button')).filter(b => {
        if (sidebar && sidebar.contains(b)) return true;
        const rect = b.getBoundingClientRect();
        return rect.left < 850 && rect.top > 90;
      });
      let foundBtn = null;
      for (const b of allButtons) {
        const text = b.textContent || '';
        if (buttonText.toLowerCase() === 'resolution' && text.includes('p')) {
          foundBtn = b;
        } else if (buttonText.toLowerCase() === 'ratio' && text.includes(':')) {
          foundBtn = b;
        } else if (buttonText.toLowerCase() === 'model' && (text.includes('Fast') || text.includes('Enhanced'))) {
          foundBtn = b;
        } else if (buttonText.toLowerCase() === 'bitrate' && (text.includes('High') || text.includes('Standard') || text.includes('Low') || text.includes('Auto'))) {
          foundBtn = b;
        }
      }
      if (foundBtn) {
        btn = foundBtn;
      }
    }

    if (!btn) {
      throw new Error(`Control button for "${buttonText}" not found`);
    }

    btn.click();

    await new Promise(r => setTimeout(r, 600));

    // Scrape portal nodes / dropdown containers
    const dropdowns = Array.from(document.querySelectorAll(
      '[role="listbox"], [role="menu"], [role="presentation"], .dropdown-menu, .popover, .portal, [class*="menu"], [class*="select"]'
    ));

    function isMatchingOption(el, text) {
      const elText = el.textContent?.trim().toLowerCase() || '';
      const targetText = text.toLowerCase();
      return elText === targetText || elText.includes(targetText);
    }

    let optionEl = null;
    for (const container of dropdowns) {
      const allEls = Array.from(container.querySelectorAll('[role="option"], [role="menuitem"], button, div, span, a, li, p'));
      const matchingEls = allEls.filter(el => isMatchingOption(el, optionText));
      
      // Filter to the deepest elements to avoid clicking wrapper containers
      const deepestMatches = matchingEls.filter(el => {
        return !matchingEls.some(other => other !== el && el.contains(other));
      });
      
      if (deepestMatches.length > 0) {
        // If there are multiple matches, sort by text length to find the closest match
        deepestMatches.sort((a, b) => {
          const aLen = (a.textContent || '').trim().length;
          const bLen = (b.textContent || '').trim().length;
          return aLen - bLen;
        });
        optionEl = deepestMatches[0];
        break;
      }
    }

    if (!optionEl) {
      // Look globally for visible options/menuitems or buttons/spans that match the text,
      // excluding the trigger button itself and its ancestors/descendants to prevent closing the dropdown.
      const globalCandidates = Array.from(document.querySelectorAll(
        '[role="option"], [role="menuitem"], button, div, span, a, li, p'
      )).filter(el => {
        if (el === btn || el.contains(btn) || btn.contains(el)) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      
      const matchingEls = globalCandidates.filter(el => isMatchingOption(el, optionText));
      
      // Filter to the deepest matching elements
      const deepestMatches = matchingEls.filter(el => {
        return !matchingEls.some(other => other !== el && el.contains(other));
      });
      
      if (deepestMatches.length > 0) {
        deepestMatches.sort((a, b) => {
          const aLen = (a.textContent || '').trim().length;
          const bLen = (b.textContent || '').trim().length;
          return aLen - bLen;
        });
        optionEl = deepestMatches[0];
      }
    }

    if (!optionEl) {
      // Dismiss dropdown
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      throw new Error(`Option "${optionText}" not found in dropdown menus`);
    }

    optionEl.click();
    await new Promise(r => setTimeout(r, 500));
  }

  // Helper: Clear the Lexical editor using Selection API, delete commands, and fallback key events
  async function clearLexicalEditor() {
    const editor = document.querySelector('div[data-lexical-editor="true"][role="textbox"]');
    if (!editor) return;

    editor.focus();
    await new Promise(r => setTimeout(r, 100));

    // Method 1: Using Selection API and native delete command
    try {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editor);
      selection.removeAllRanges();
      selection.addRange(range);
      
      document.execCommand('delete', false, null);
      await new Promise(r => setTimeout(r, 100));
    } catch (e) {
      console.warn('Selection API clear failed:', e);
    }

    // Method 2: selectAll + delete fallback
    try {
      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
      await new Promise(r => setTimeout(r, 100));
    } catch (e) {
      console.warn('execCommand selectAll clear failed:', e);
    }

    // Method 3: If text persists, fall back to keyboard event simulation
    if ((editor.textContent || '').trim().length > 0) {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? 'metaKey' : 'ctrlKey';

      editor.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'a', code: 'KeyA', keyCode: 65, which: 65,
        [modKey]: true, bubbles: true, cancelable: true
      }));
      await new Promise(r => setTimeout(r, 50));
      editor.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Backspace', code: 'Backspace', keyCode: 8, which: 8,
        bubbles: true, cancelable: true
      }));
      editor.dispatchEvent(new InputEvent('beforeinput', {
        inputType: 'deleteContentBackward',
        bubbles: true, cancelable: true, composed: true
      }));
      editor.dispatchEvent(new KeyboardEvent('keyup', {
        key: 'Backspace', code: 'Backspace', keyCode: 8, which: 8,
        bubbles: true
      }));
      await new Promise(r => setTimeout(r, 100));
    }
  }

  // Helper: check if an image thumbnail is referenced in the prompt text
  function isImageReferenced(img, promptText) {
    if (!promptText) return false;
    
    const alt = (img.getAttribute('alt') || '').toLowerCase().trim();
    const title = (img.getAttribute('title') || '').toLowerCase().trim();
    const src = (img.getAttribute('src') || '').toLowerCase().trim();
    
    // Check parent elements for any text labels (e.g. "women-1", "Image 1")
    let parentText = '';
    let parent = img.parentElement;
    let count = 0;
    while (parent && parent !== document.body && count < 3) {
      parentText += ' ' + (parent.textContent || '');
      parent = parent.parentElement;
      count++;
    }
    parentText = parentText.toLowerCase().trim();
    
    const promptLower = promptText.toLowerCase().trim();
    
    // 1. Check if the prompt explicitly contains the alt or title
    if (alt && promptLower.includes(alt)) return true;
    if (title && promptLower.includes(title)) return true;

    // 2. Check for @[label] references in the prompt (e.g. @[women-1])
    const matches = promptLower.match(/@\[([^\]]+)\]/g);
    if (matches) {
      for (const match of matches) {
        const label = match.slice(2, -1).trim(); // Extract "women-1"
        if (alt.includes(label) || title.includes(label) || parentText.includes(label)) {
          return true;
        }
      }
    }
    
    // 3. General check: if parentText contains a word that matches a token in the prompt
    // For example, if parent text says "women-1" and the prompt text has "women-1"
    const tokens = parentText.split(/[\s,()\[\]={}]+/).map(t => t.trim()).filter(t => t.length > 2);
    for (const token of tokens) {
      if (promptLower.includes(token)) {
        return true;
      }
    }
    
    return false;
  }

  // Automation bridge functions
  const automationBridge = {
    ensureOnVideoPage: async function () {
      // Strip recreateJobSetId from URL if present to prevent auto-restoration on re-render
      if (window.location.search.includes('recreateJobSetId')) {
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('recreateJobSetId');
          window.history.replaceState({}, '', url.pathname + url.search);
        } catch (e) {
          console.warn('Failed to strip recreateJobSetId from URL:', e);
        }
      }

      const targetUrl = 'https://higgsfield.ai/ai/video';
      if (window.location.href.startsWith(targetUrl)) {
        return true;
      }
      window.location.href = targetUrl;
      return false;
    },

    resetForm: async function (newPrompt) {
      // Strip recreateJobSetId from URL if present to prevent auto-restoration
      if (window.location.search.includes('recreateJobSetId')) {
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('recreateJobSetId');
          window.history.replaceState({}, '', url.pathname + url.search);
        } catch (e) {
          console.warn('Failed to strip recreateJobSetId from URL:', e);
        }
      }

      // Step 1: Clear the prompt text box using keyboard event simulation
      await clearLexicalEditor();
      await new Promise(r => setTimeout(r, 200));

      // Step 2: Remove all uploaded reference images (except those used in the prompt)
      const sidebar = getSidebar();
      const thumbnails = Array.from(document.querySelectorAll('img')).filter(img => {
        if (sidebar && sidebar.contains(img)) return true;
        const rect = img.getBoundingClientRect();
        return rect.left < 850 && rect.top > 90;
      });
      let removedCount = 0;

      for (const img of thumbnails) {
        // Skip images that are referenced in the new prompt so we don't wipe them out!
        if (isImageReferenced(img, newPrompt)) {
          console.log('Keeping referenced image thumbnail:', img.getAttribute('alt') || 'Reference Image');
          continue;
        }

        // Hover the thumbnail card and its ancestors to activate CSS/React hover class handlers
        let hoverTarget = img;
        for (let k = 0; k < 3 && hoverTarget; k++) {
          hoverTarget.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
          hoverTarget.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
          hoverTarget = hoverTarget.parentElement;
        }
        await new Promise(r => setTimeout(r, 150));

        let parent = img.parentElement;
        let count = 0;
        let clicked = false;

        // Traverse up to 4 parent levels to find the thumbnail container
        while (parent && parent !== document.body && count < 4 && !clicked) {
          // Find all potentially clickable elements in this container
          const elements = Array.from(parent.querySelectorAll('button, [role="button"], div, span, svg'));
          
          for (const el of elements) {
            const text = (el.textContent || '').trim().toLowerCase();
            const label = (el.getAttribute('aria-label') || el.getAttribute('title') || '').toLowerCase();
            const className = (el.className || '').toLowerCase();
            
            // Exclude main upload / change / edit triggers
            if (text.includes('change') || text.includes('edit') || text.includes('upload') ||
                label.includes('change') || label.includes('edit') || label.includes('upload')) {
              continue;
            }

            // A valid close button candidate must:
            // 1. Have close/delete/remove keywords, OR
            // 2. Have standard close text (x, ×, etc.), OR
            // 3. Be a small element (width/height < 45px) containing an SVG or close text
            const isCloseText = text === '×' || text === 'x' || text === '✕' || text === '✖' || text === '╳';
            const isCloseKeyword = label.includes('remove') || label.includes('delete') || label.includes('close') || label.includes('clear') ||
                                   className.includes('remove') || className.includes('delete') || className.includes('close') || className.includes('clear');
            
            // Check bounding rect (allow 0-sized elements that are hidden via hover state styles)
            const rect = el.getBoundingClientRect();
            const isSmall = rect.width === 0 || (rect.width > 0 && rect.width < 45);
            const isSvg = el.tagName.toLowerCase() === 'svg' || el.querySelector('svg');

            if (isCloseText || isCloseKeyword || (isSmall && (isSvg || isCloseText))) {
              try {
                // Force visibility styles to bypass display: none or opacity: 0 rules
                try {
                  el.style.setProperty('display', 'block', 'important');
                  el.style.setProperty('opacity', '1', 'important');
                  el.style.setProperty('visibility', 'visible', 'important');
                } catch (styleErr) {
                  // Some elements (like raw SVG elements) don't support custom inline styles directly, which is fine
                }

                // Dispatch pointer and mouse events to satisfy React handlers
                el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
                el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
                el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                el.click();
                
                removedCount++;
                clicked = true;
                await new Promise(r => setTimeout(r, 300));
                break;
              } catch (e) {
                console.warn('Failed to click remove image element:', e);
              }
            }
          }
          parent = parent.parentElement;
          count++;
        }
      }

      if (removedCount > 0) {
        console.log(`Successfully removed ${removedCount} reference image(s).`);
      }
    },

    setModel: async function (model) {
      await selectDropdownOption('Model', model);
    },

    setDuration: async function (seconds) {
      // Find duration button inside the settings sidebar
      const sidebar = getSidebar() || document.body;
      const buttons = Array.from(sidebar.querySelectorAll('button, div[role="button"], span[role="button"]'));
      let durationBtn = null;

      // 1. Find by exact/partial "duration" label
      for (const btn of buttons) {
        const text = (btn.textContent || '').trim().toLowerCase();
        const label = (btn.getAttribute('aria-label') || '').toLowerCase();
        if (text === 'duration' || label === 'duration' || text.includes('duration') || label.includes('duration')) {
          durationBtn = btn;
          break;
        }
      }

      // 2. Find by pattern (e.g. "5s", "5 s", "10s", etc.)
      if (!durationBtn) {
        for (const btn of buttons) {
          const text = (btn.textContent || '').trim();
          if (/\b\d+\s*s\b/i.test(text)) {
            durationBtn = btn;
            break;
          }
        }
      }

      // 3. Fallback to global query if not found inside sidebar
      if (!durationBtn) {
        durationBtn = findButtonByText('Duration') || findButtonByText(' s');
      }

      if (!durationBtn) {
        throw new Error('Duration button not found on page');
      }

      // Open the slider popover dialog (if not already open)
      let slider = document.querySelector('[role="slider"]') || 
                   document.querySelector('input[type="range"]') ||
                   document.querySelector('.radix-slider-thumb') ||
                   document.querySelector('[data-radix-slider-thumb]');
      
      if (!slider) {
        durationBtn.click();
        // Poll for the slider to appear in the DOM (up to 1.5 seconds)
        for (let i = 0; i < 15; i++) {
          await new Promise(r => setTimeout(r, 100));
          slider = document.querySelector('[role="slider"]') || 
                   document.querySelector('input[type="range"]') ||
                   document.querySelector('.radix-slider-thumb') ||
                   document.querySelector('[data-radix-slider-thumb]');
          if (slider) break;
        }
      }

      if (!slider) {
        throw new Error('Duration slider control not found after clicking duration button');
      }

      // Helper function to extract current slider value
      function getSliderValue(el) {
        let valAttr = el.getAttribute('aria-valuenow') || el.getAttribute('value');
        if (valAttr) {
          const parsed = parseInt(valAttr, 10);
          if (!isNaN(parsed)) return parsed;
        }
        const container = el.closest('[class*="slider"], [data-radix-slider-root]') || el.parentElement;
        if (container) {
          const input = container.querySelector('input');
          if (input && input.value) {
            const parsed = parseInt(input.value, 10);
            if (!isNaN(parsed)) return parsed;
          }
        }
        return 4; // Default fallback
      }

      // Change the value
      if (slider.tagName.toLowerCase() === 'input') {
        slider.value = seconds;
        slider.dispatchEvent(new Event('input', { bubbles: true }));
        slider.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        slider.focus();
        await new Promise(r => setTimeout(r, 100));

        const currentVal = getSliderValue(slider);
        const diff = seconds - currentVal;
        if (diff !== 0) {
          const key = diff > 0 ? 'ArrowRight' : 'ArrowLeft';
          const keyCode = key === 'ArrowRight' ? 39 : 37;
          const presses = Math.abs(diff);

          for (let i = 0; i < presses; i++) {
            const keydown = new KeyboardEvent('keydown', { 
              key, 
              code: key, 
              keyCode: keyCode, 
              which: keyCode, 
              bubbles: true, 
              cancelable: true 
            });
            const keyup = new KeyboardEvent('keyup', { 
              key, 
              code: key, 
              keyCode: keyCode, 
              which: keyCode, 
              bubbles: true, 
              cancelable: true 
            });
            
            slider.dispatchEvent(keydown);
            slider.dispatchEvent(keyup);

            // Also dispatch directly on the slider container root
            const container = slider.closest('[class*="slider"], [data-radix-slider-root]') || slider.parentElement;
            if (container && container !== slider) {
              container.dispatchEvent(keydown);
              container.dispatchEvent(keyup);
            }

            await new Promise(r => setTimeout(r, 150));
          }
        }

        // Direct value update as fallback
        const container = slider.closest('[class*="slider"], [data-radix-slider-root]') || slider.parentElement;
        if (container) {
          const hiddenInput = container.querySelector('input');
          if (hiddenInput) {
            try {
              const nativeValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
              nativeValueSetter.call(hiddenInput, seconds);
              hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
              hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
            } catch (e) {
              console.warn('Failed to set hidden input value directly:', e);
            }
          }
        }
      }

      // Close the duration slider dialog panel
      const escapeEvent = new KeyboardEvent('keydown', { 
        key: 'Escape', 
        code: 'Escape', 
        keyCode: 27, 
        which: 27, 
        bubbles: true, 
        cancelable: true 
      });
      document.dispatchEvent(escapeEvent);
      await new Promise(r => setTimeout(r, 500));

      // Click body to close if still present
      const checkSlider = document.querySelector('[role="slider"]') || document.querySelector('.radix-slider-thumb');
      if (checkSlider) {
        document.body.click();
        await new Promise(r => setTimeout(r, 300));
      }
    },

    setResolution: async function (resolution) {
      await selectDropdownOption('Resolution', resolution);
    },

    setRatio: async function (ratio) {
      try {
        await selectDropdownOption('Ratio', ratio);
      } catch (err) {
        // Fallback: some panels may not expose Aspect Ratio or title it differently, log warning
        console.warn('Aspect ratio setting could not be applied:', err.message);
      }
    },

    setBitrate: async function (bitrate) {
      try {
        await selectDropdownOption('Bitrate', bitrate);
      } catch (err) {
        console.warn('Bitrate setting could not be applied:', err.message);
      }
    },
    setPrompt: async function (text) {
      const editor = document.querySelector('div[data-lexical-editor="true"][role="textbox"]');
      if (!editor) {
        throw new Error('Lexical editor element not found on page');
      }

      // 1. Clear content once using standard keyboard shortcuts
      await clearLexicalEditor();
      await new Promise(r => setTimeout(r, 200));

      // 2. Focus the empty editor
      editor.focus();
      await new Promise(r => setTimeout(r, 100));

      // 3. Paste the prompt text via ClipboardEvent (which does not trigger autocomplete dropdowns)
      try {
        const clipboardData = new DataTransfer();
        clipboardData.setData('text/plain', text);
        const pasteEvent = new ClipboardEvent('paste', {
          clipboardData: clipboardData,
          bubbles: true,
          cancelable: true
        });
        editor.dispatchEvent(pasteEvent);
      } catch (err) {
        console.warn('Paste event failed, using DOM fallback:', err);
        editor.innerText = text;
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        editor.dispatchEvent(new Event('change', { bubbles: true }));
      }
      await new Promise(r => setTimeout(r, 300));

      // 4. Dismiss any active autocomplete or history suggestion popups that might have opened
      const esc = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true });
      editor.dispatchEvent(esc);
      document.dispatchEvent(esc);
      await new Promise(r => setTimeout(r, 150));
    },
    clickGenerate: async function () {
      let generateBtn = null;
      const buttons = Array.from(document.querySelectorAll('button'));
      for (const btn of buttons) {
        const text = (btn.textContent || '').trim().toLowerCase();
        if (text.includes('generate')) {
          generateBtn = btn;
          break;
        }
      }

      if (!generateBtn) {
        throw new Error('Generate button not found');
      }

      if (generateBtn.hasAttribute('disabled') || generateBtn.disabled) {
        throw new Error('Generate button is currently disabled (possible rendering in progress or zero credits)');
      }

      generateBtn.click();
      await new Promise(r => setTimeout(r, 1000));
    },

    getActiveGenerationCount: async function () {
      const textNodes = [];
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
      let node;
      while (node = walk.nextNode()) {
        const text = node.nodeValue.trim().toLowerCase();
        if (text.includes('processing') || text.includes('generating') || text.includes('in queue') || text.includes('rendering')) {
          const parent = node.parentElement;
          if (parent && parent.getBoundingClientRect().width > 0 && parent.getBoundingClientRect().height > 0) {
            textNodes.push(parent);
          }
        }
      }

      // Scan for visual spinner/loader elements (catches blank spinner cards)
      const spinnerSelectors = [
        '.animate-spin',
        '[class*="spinner"]',
        '[class*="loader"]',
        '[class*="loading"]',
        '[class*="processing"]',
        'svg animateTransform',
        '[role="progressbar"]',
        '[aria-busy="true"]'
      ];

      const spinners = Array.from(document.querySelectorAll(spinnerSelectors.join(', ')));
      for (const spinner of spinners) {
        // Skip elements inside the extension popup/sidebar itself
        if (spinner.closest('#higgsfield-batch-sidebar') || spinner.closest('.app-container')) continue;

        // Check if the spinner is visible
        const rect = spinner.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const card = spinner.closest('li, [class*="item"], [class*="card"], [class*="history"]') || spinner;
          textNodes.push(card);
        }
      }

      const uniqueParents = new Set(textNodes);
      return uniqueParents.size;
    },

    checkStatusBanners: async function () {
      const stats = {
        creditsExhausted: false,
        nsfwDetected: false,
        failed: false
      };

      // Search only active visible alerts, modal boxes, status banners, or toast notifications
      const alertElements = Array.from(document.querySelectorAll(
        '[role="alert"], [role="status"], [role="dialog"], ' +
        '[class*="toast"], [class*="modal"], [class*="alert"], [class*="notification"], ' +
        '.error, .alert'
      ));

      for (const el of alertElements) {
        // Skip elements inside the extension's side panel/containers
        if (el.closest('#higgsfield-batch-sidebar') || el.closest('.app-container')) continue;

        // Skip invisible elements
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;

        const elText = (el.textContent || '').toLowerCase();
        
        if (elText.includes('credit')) {
          stats.creditsExhausted = true;
        }
        if (elText.includes('nsfw') || elText.includes('policy') || elText.includes('unsafe') || elText.includes('sensitive')) {
          stats.nsfwDetected = true;
        }
        if (elText.includes('failed') || elText.includes('refund')) {
          stats.failed = true;
        }
      }

      return stats;
    }
  };

  // Expose bridge globally
  window.__higgsfieldBridge = automationBridge;

  // Runtime messaging interface
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'ping') {
      sendResponse({ status: 'ok' });
      return;
    }

    if (automationBridge[request.action]) {
      const args = request.prompt !== undefined ? [request.prompt] :
                   request.model !== undefined ? [request.model] :
                   request.duration !== undefined ? [request.duration] :
                   request.resolution !== undefined ? [request.resolution] :
                   request.ratio !== undefined ? [request.ratio] :
                   request.bitrate !== undefined ? [request.bitrate] : [];

      automationBridge[request.action](...args)
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ error: error.message || error }));

      return true; // Keep channel open for asynchronous reply
    }
  });

  // Initial scan on load
  setupExtension();

  // Watch for DOM changes to handle page transitions or React re-rendering
  const observer = new MutationObserver(() => {
    setupExtension();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
})();

(function () {
  'use strict';

  // Setup/Update styling and injection on the prompt container
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

    // Inject Expand button to parent2 if it doesn't exist yet
    if (!parent2.querySelector('.higgsfield-prompt-expand-btn')) {
      const expandBtn = document.createElement('button');
      expandBtn.className = 'higgsfield-prompt-expand-btn';
      expandBtn.setAttribute('title', 'Toggle Expanded View');
      expandBtn.setAttribute('type', 'button');

      // Double Chevron Down (Expand) and Double Chevron Up (Collapse)
      const expandIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 13 12 18 17 13"></polyline><polyline points="7 6 12 11 17 6"></polyline></svg>`;
      const collapseIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 11 12 6 7 11"></polyline><polyline points="17 18 12 13 7 18"></polyline></svg>`;

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
          // Clear any inline height overrides set by dragging when collapsed
          parent2.style.height = '';
        }
      });
    }
  }

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


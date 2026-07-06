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

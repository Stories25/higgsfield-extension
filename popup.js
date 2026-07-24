// Higgsfield Batch Generator Popup Logic (Side Panel)

document.addEventListener('DOMContentLoaded', () => {
  // UI Elements
  const promptInput = document.getElementById('prompt-list-input');
  
  const badge = document.getElementById('global-status-badge');
  const badgeText = document.getElementById('global-status-text');
  
  const setDuration = document.getElementById('set-duration');
  const setResolution = document.getElementById('set-resolution');
  const setRatio = document.getElementById('set-ratio');
  const setBitrate = document.getElementById('set-bitrate');
  
  const progressCard = document.getElementById('progress-card');
  const activePromptTitle = document.getElementById('active-prompt-title');
  const activeProgressIndex = document.getElementById('active-progress-index');
  const progressBarFill = document.getElementById('progress-bar-fill');
  
  const logsConsole = document.getElementById('logs-console');
  const clearLogsBtn = document.getElementById('clear-logs');
  
  const btnCheckStart = document.getElementById('btn-check-start');
  const btnFillOnly = document.getElementById('btn-fill-only');
  const btnClearForm = document.getElementById('btn-clear-form');
  const btnPromptOnly = document.getElementById('btn-prompt-only');
  const btnPause = document.getElementById('btn-pause');
  const btnStop = document.getElementById('btn-stop');

  // Queue Specific UI Elements
  const btnAddPrompt = document.getElementById('btn-add-prompt');
  const btnPasteCSV = document.getElementById('btn-paste-csv');
  const btnUploadFile = document.getElementById('btn-upload-file');
  const btnDownloadSample = document.getElementById('btn-download-sample');
  const fileImportInput = document.getElementById('file-import-input');
  const btnClearQueue = document.getElementById('btn-clear-queue');
  const queueListContainer = document.getElementById('queue-list-container');
  const queueCount = document.getElementById('queue-count');

  // Interceptor UI Elements
  const tabBtnGenerator = document.getElementById('tab-btn-generator');
  const tabBtnInterceptor = document.getElementById('tab-btn-interceptor');
  const paneGenerator = document.getElementById('tab-pane-generator');
  const paneInterceptor = document.getElementById('tab-pane-interceptor');
  const viewBtnPicker = document.getElementById('view-btn-picker');
  const viewBtnJobs = document.getElementById('view-btn-jobs');
  const groupPickerSize = document.getElementById('group-picker-size');
  const groupJobsSize = document.getElementById('group-jobs-size');
  const interceptorPickerSizeSelect = document.getElementById('interceptor-picker-size');
  const interceptorJobsSizeSelect = document.getElementById('interceptor-jobs-size');
  const interceptorToggle = document.getElementById('interceptor-toggle');
  const interceptorStatusBanner = document.getElementById('interceptor-status-banner');
  const interceptorStatusText = document.getElementById('interceptor-status-text');
  const interceptorEmptyState = document.getElementById('interceptor-empty-state');
  const interceptorLoadingState = document.getElementById('interceptor-loading-state');
  const interceptorResultsCard = document.getElementById('interceptor-results-card');
  const respStatus = document.getElementById('resp-status');
  const respTotal = document.getElementById('resp-total');
  const respTime = document.getElementById('resp-time');
  const respSize = document.getElementById('resp-size');
  const btnCopyJson = document.getElementById('btn-copy-json');
  const btnDownloadJson = document.getElementById('btn-download-json');
  const previewList = document.getElementById('interceptor-preview-list');
  const btnRedirectReload = document.getElementById('btn-redirect-reload');
  const btnEmptyRedirectReload = document.getElementById('btn-empty-redirect-reload');

  // Automation UI Elements
  const tabBtnAutomation = document.getElementById('tab-btn-automation');
  const paneAutomation = document.getElementById('tab-pane-automation');
  const autoApiUrlInput = document.getElementById('auto-api-url');
  const autoJwtTokenInput = document.getElementById('auto-jwt-token');
  const btnSaveAutomationConfig = document.getElementById('btn-save-automation-config');
  const autoConnectionBadge = document.getElementById('automation-connection-badge');
  const autoStatusFilter = document.getElementById('auto-status-filter');
  const btnFetchAutomations = document.getElementById('btn-fetch-automations');
  const btnImportAllAutomations = document.getElementById('btn-import-all-automations');
  const autoUserFilter = document.getElementById('auto-user-filter');
  const automationListContainer = document.getElementById('automation-list-container');
  const automationSettingsToggleHeader = document.getElementById('automation-settings-toggle-header');
  const automationSettingsCard = document.getElementById('automation-settings-card');

  let currentStatus = 'idle';
  let currentFetchedAutomations = [];

  // Custom Floating Tooltip Setup
  const tooltip = document.createElement('div');
  tooltip.className = 'custom-tooltip hidden';
  document.body.appendChild(tooltip);

  let hideTooltipTimeout = null;

  function positionTooltip(e) {
    const tooltipWidth = tooltip.offsetWidth;
    const tooltipHeight = tooltip.offsetHeight;
    
    let x = e.clientX + 12;
    let y = e.clientY + 12;
    
    // Check bounds
    if (x + tooltipWidth > window.innerWidth) {
      x = e.clientX - tooltipWidth - 12;
    }
    if (y + tooltipHeight > window.innerHeight) {
      y = e.clientY - tooltipHeight - 12;
    }
    
    // Clamp to viewport
    x = Math.max(8, Math.min(x, window.innerWidth - tooltipWidth - 8));
    y = Math.max(8, Math.min(y, window.innerHeight - tooltipHeight - 8));
    
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
  }

  document.body.addEventListener('mouseover', (e) => {
    const target = e.target.closest('[data-tooltip]');
    if (!target) return;

    const text = target.getAttribute('data-tooltip');
    if (!text || text.trim() === '') return;

    if (hideTooltipTimeout) {
      clearTimeout(hideTooltipTimeout);
      hideTooltipTimeout = null;
    }

    tooltip.textContent = text;
    tooltip.classList.remove('hidden');
    tooltip.offsetHeight; // Force reflow
    tooltip.classList.add('visible');
    
    positionTooltip(e);
  });

  document.body.addEventListener('mousemove', (e) => {
    const target = e.target.closest('[data-tooltip]');
    if (!target || !tooltip.classList.contains('visible')) return;

    positionTooltip(e);
  });

  document.body.addEventListener('mouseout', (e) => {
    const target = e.target.closest('[data-tooltip]');
    if (!target) return;

    if (e.relatedTarget && target.contains(e.relatedTarget)) {
      return;
    }

    tooltip.classList.remove('visible');
    if (hideTooltipTimeout) {
      clearTimeout(hideTooltipTimeout);
    }
    hideTooltipTimeout = setTimeout(() => {
      if (!tooltip.classList.contains('visible')) {
        tooltip.classList.add('hidden');
      }
    }, 120);
  });


  // Load Saved Input and Settings on open
  chrome.storage.local.get(['savedPrompts', 'savedSettings'], (data) => {
    if (data.savedPrompts) {
      promptInput.value = data.savedPrompts;
    }
    if (data.savedSettings) {
      applySettingsToForm(data.savedSettings);
    }
  });

  // Query Background Service Worker status
  chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
    if (response) {
      updateUI(response);
    }
  });

  // Handle runtime messages from background script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'stateUpdated' && message.state) {
      updateUI(message.state);
    } else if (message.action === 'interceptStateUpdated' && message.state) {
      renderInterceptorState(message.state);
    }
  });

  // Sync state changes on local storage (updates when content script or background script changes storage)
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (changes.batchState && changes.batchState.newValue) {
      updateUI(changes.batchState.newValue);
    }
    if (changes.interceptState && changes.interceptState.newValue) {
      renderInterceptorState(changes.interceptState.newValue);
    }
  });

  // Listen to prompt textarea input updates
  promptInput.addEventListener('input', () => {
    chrome.storage.local.set({ savedPrompts: promptInput.value });
  });

  // Listen to select/input updates and save to local storage
  const selectElements = ['set-duration', 'set-resolution', 'set-ratio', 'set-bitrate'];
  selectElements.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', () => {
        const settings = readSettingsFromForm();
        chrome.storage.local.set({ savedSettings: settings });
      });
    }
  });

  // Queue Controls Event Listeners
  btnAddPrompt.addEventListener('click', () => {
    const text = promptInput.value.trim();
    if (text.length === 0) return;
    
    const prompts = [text];

    chrome.runtime.sendMessage({ action: 'bulkImport', prompts }, (response) => {
      if (response && response.success) {
        promptInput.value = '';
        chrome.storage.local.set({ savedPrompts: '' });
        updateUI(response.state);
      }
    });
  });

  // Helper: Robust CSV/TSV Parser
  function parseCSVOrTSV(text) {
    if (!text || text.trim() === '') return [];
    
    const firstLine = text.split(/\r?\n/)[0] || '';
    const delimiter = (firstLine.includes('\t') && !firstLine.includes(',')) ? '\t' : ',';
    
    const rows = [];
    let currentRow = [''];
    let inQuotes = false;
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentRow[currentRow.length - 1] += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        currentRow.push('');
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        rows.push(currentRow);
        currentRow = [''];
      } else {
        currentRow[currentRow.length - 1] += char;
      }
    }
    
    if (currentRow.length > 1 || currentRow[0] !== '') {
      rows.push(currentRow);
    }
    
    return rows;
  }

  // Helper: Extract prompts from parsed CSV/TSV grid
  function extractPromptsFromRows(rows) {
    if (rows.length === 0) return { prompts: [], columnName: '' };
    
    const cleanRows = rows.filter(row => row.some(cell => cell.trim().length > 0));
    if (cleanRows.length === 0) return { prompts: [], columnName: '' };
    
    const headerRow = cleanRows[0];
    let promptColumnIndex = 0;
    let startRow = 0;
    
    const headerKeywords = ['prompt', 'prompts', 'text', 'desc', 'description', 'body', 'input', 'queries', 'query', 'content'];
    const looksLikeHeader = headerRow.some(cell => {
      const clean = cell.trim().toLowerCase();
      return headerKeywords.includes(clean);
    });
    
    if (looksLikeHeader) {
      const index = headerRow.findIndex(cell => {
        const clean = cell.trim().toLowerCase();
        return headerKeywords.some(kw => clean.includes(kw));
      });
      if (index !== -1) {
        promptColumnIndex = index;
        startRow = 1;
      }
    }
    
    const prompts = [];
    for (let i = startRow; i < cleanRows.length; i++) {
      const cellValue = cleanRows[i][promptColumnIndex];
      if (cellValue && cellValue.trim().length > 0) {
        prompts.push(cellValue.trim());
      }
    }
    
    return {
      prompts,
      columnName: looksLikeHeader ? headerRow[promptColumnIndex] : `Column #${promptColumnIndex + 1}`
    };
  }

  // Download Sample CSV Handler
  btnDownloadSample.addEventListener('click', () => {
    const csvContent = "prompt\n\"A futuristic city with flying vehicles, 8k resolution, photorealistic\"\n\"A majestic dragon perched on a mountain peak, fantasy art, cinematic lighting\"\n\"A cute orange cat wearing a space suit, digital painting, highly detailed\"\n";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'sample_prompts.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  // File Upload Handlers
  btnUploadFile.addEventListener('click', () => {
    fileImportInput.click();
  });

  fileImportInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const fileContent = e.target.result;
      const fileExtension = file.name.split('.').pop().toLowerCase();
      let prompts = [];

      if (fileExtension === 'txt') {
        prompts = fileContent
          .split(/\r?\n/)
          .map(p => p.trim())
          .filter(p => p.length > 0);
      } else {
        const rows = parseCSVOrTSV(fileContent);
        const result = extractPromptsFromRows(rows);
        prompts = result.prompts;
      }

      if (prompts.length === 0) {
        alert('No prompts could be found or parsed from the file.');
        return;
      }

      chrome.runtime.sendMessage({ action: 'bulkImport', prompts }, (response) => {
        if (response && response.success) {
          updateUI(response.state);
        }
      });
      
      fileImportInput.value = '';
    };

    reader.readAsText(file);
  });

  btnPasteCSV.addEventListener('click', () => {
    const text = promptInput.value.trim();
    if (text.length === 0) {
      alert('Please paste CSV/TSV text into the input field first.');
      return;
    }

    const rows = parseCSVOrTSV(text);
    const result = extractPromptsFromRows(rows);
    const prompts = result.prompts;

    if (prompts.length === 0) {
      alert('No prompts could be found or parsed from the pasted CSV/TSV data.');
      return;
    }

    chrome.runtime.sendMessage({ action: 'bulkImport', prompts }, (response) => {
      if (response && response.success) {
        promptInput.value = '';
        chrome.storage.local.set({ savedPrompts: '' });
        updateUI(response.state);
      }
    });
  });

  btnClearQueue.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all prompts from the queue?')) {
      chrome.runtime.sendMessage({ action: 'clearQueue' }, (response) => {
        if (response && response.success) {
          updateUI(response.state);
        }
      });
    }
  });

  // Control Buttons Event Listeners
  btnCheckStart.addEventListener('click', () => {
    if (currentStatus === 'paused') {
      chrome.runtime.sendMessage({ action: 'resume' }, (response) => {
        if (response && response.success) {
          updateUI(response.state);
        }
      });
      return;
    }

    const settings = readSettingsFromForm();
    chrome.storage.local.set({ savedSettings: settings });

    function startQueue() {
      chrome.runtime.sendMessage({ action: 'start', settings, useCheck: true }, (response) => {
        if (response && response.success) {
          updateUI(response.state);
        } else if (response && response.error) {
          alert(response.error);
        }
      });
    }

    const text = promptInput.value.trim();
    if (text.length > 0) {
      const prompts = [text];
      chrome.runtime.sendMessage({ action: 'bulkImport', prompts }, (importResponse) => {
        if (importResponse && importResponse.success) {
          promptInput.value = '';
          chrome.storage.local.set({ savedPrompts: '' });
          startQueue();
        }
      });
      return;
    }

    startQueue();
  });
  
  btnFillOnly.addEventListener('click', () => {
    const settings = readSettingsFromForm();
    chrome.storage.local.set({ savedSettings: settings });

    btnFillOnly.disabled = true;
    const oldText = btnFillOnly.innerHTML;
    btnFillOnly.textContent = 'Applying...';

    chrome.runtime.sendMessage({ action: 'fillOnly', settings: settings }, (response) => {
      btnFillOnly.disabled = false;
      btnFillOnly.innerHTML = oldText;
      if (chrome.runtime.lastError) {
        alert('Failed to connect to page context. Please make sure the active tab is on Higgsfield and refresh.');
      }
    });
  });

  btnPromptOnly.addEventListener('click', () => {
    const promptText = promptInput.value.trim();
    if (promptText.length === 0) {
      alert('Please enter a video generation prompt.');
      return;
    }

    btnPromptOnly.disabled = true;
    const oldText = btnPromptOnly.innerHTML;
    btnPromptOnly.textContent = 'Inserting...';

    chrome.runtime.sendMessage({ action: 'insertPromptOnly', prompt: promptText }, (response) => {
      btnPromptOnly.disabled = false;
      btnPromptOnly.innerHTML = oldText;
      if (chrome.runtime.lastError) {
        alert('Failed to connect to page context. Please make sure the active tab is on Higgsfield and refresh.');
      }
    });
  });

  btnClearForm.addEventListener('click', () => {
    btnClearForm.disabled = true;
    const oldText = btnClearForm.innerHTML;
    btnClearForm.textContent = 'Clearing...';

    chrome.runtime.sendMessage({ action: 'clearForm' }, (response) => {
      btnClearForm.disabled = false;
      btnClearForm.innerHTML = oldText;
      if (chrome.runtime.lastError) {
        alert('Failed to connect to page context. Please make sure the active tab is on Higgsfield and refresh.');
      }
    });
  });

  btnPause.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'pause' }, (response) => {
      if (response && response.success) {
        updateUI(response.state);
      }
    });
  });

  btnStop.addEventListener('click', () => {
    if (confirm('Are you sure you want to stop the batch? This will reset the progress.')) {
      chrome.runtime.sendMessage({ action: 'stop' }, (response) => {
        if (response && response.success) {
          updateUI(response.state);
        }
      });
    }
  });

  // Console Clear
  clearLogsBtn.addEventListener('click', () => {
    logsConsole.innerHTML = '<div class="log-line system-line">[Cleared View - logs continue in background]</div>';
  });

  // Helper: Read setting states from DOM form elements
  function readSettingsFromForm() {
    return {
      duration: parseInt(setDuration.value, 10) || 5,
      resolution: setResolution.value,
      ratio: setRatio.value,
      bitrate: setBitrate.value
    };
  }

  // Helper: Sync values to form input elements
  function applySettingsToForm(settings) {
    if (!settings) return;
    setDuration.value = settings.duration || 5;
    setResolution.value = settings.resolution || '720p';
    setRatio.value = settings.ratio || '21:9';
    setBitrate.value = settings.bitrate || 'High';
  }

  // Helper: Escape HTML characters for rendering
  function escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Render Full State to UI Layout
  function updateUI(state) {
    if (!state) return;

    currentStatus = state.status;

    // Update Status Badge Styling
    badge.className = 'status-indicator';
    badge.classList.add(state.status);
    badgeText.textContent = state.status;

    // Sync form settings if not running
    if (state.status !== 'running' && state.status !== 'paused') {
      applySettingsToForm(state.settings);
    }

    // Render Queue List
    const prompts = state.prompts || [];
    queueCount.textContent = prompts.length;

    const isRunningOrPaused = state.status === 'running' || state.status === 'paused';

    if (prompts.length === 0) {
      queueListContainer.innerHTML = '<div class="queue-empty-state">No prompts in queue. Add some above to start.</div>';
      btnCheckStart.disabled = true;
    } else {
      // Button status
      btnCheckStart.disabled = (state.status === 'running');
      queueListContainer.innerHTML = '';
      
      prompts.forEach((item, index) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'queue-item';
        if (state.currentIndex === index && state.status === 'running') {
          itemEl.classList.add('running');
        }

        itemEl.innerHTML = `
          <div class="queue-item-content">
            <div class="queue-item-meta" style="display: flex; gap: 6px; align-items: center;">
              <span class="queue-item-index">#${index + 1}</span>
              <span class="status-badge ${item.status}">${item.status}</span>
              ${item.backendAutomationId ? `
                <span style="font-size: 10px; color: var(--text-muted); display: flex; align-items: center; gap: 4px; background: rgba(255,255,255,0.04); padding: 2px 6px; border-radius: 4px; font-family: 'JetBrains Mono', monospace;" title="Imported from Backend Automations: ${escapeHtml(item.backendAutomationId)}">
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8v13H3V8"></path><polyline points="1 3 23 3 23 8 1 8 1 3"></polyline><path d="M10 12h4"></path></svg>
                  ${escapeHtml(item.backendAutomationId.split('-')[0])}
                </span>
              ` : ''}
            </div>
            <div class="queue-item-text" data-tooltip="${escapeHtml(item.text)}">${escapeHtml(item.text)}</div>
          </div>
          <button class="btn-remove-item" data-index="${index}" title="Remove prompt" ${isRunningOrPaused ? 'disabled' : ''}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        `;
        queueListContainer.appendChild(itemEl);
      });

      // Bind remove buttons
      const removeButtons = queueListContainer.querySelectorAll('.btn-remove-item');
      removeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          const index = parseInt(btn.getAttribute('data-index'), 10);
          chrome.runtime.sendMessage({ action: 'removePrompt', index }, (response) => {
            if (response && response.success) {
              updateUI(response.state);
            }
          });
        });
      });
    }

    // Layout configuration based on run status
    if (state.status === 'running') {
      promptInput.disabled = true;
      setDuration.disabled = true;
      setResolution.disabled = true;
      setRatio.disabled = true;
      setBitrate.disabled = true;

      btnAddPrompt.disabled = true;
      btnPasteCSV.disabled = true;
      btnUploadFile.disabled = true;
      btnDownloadSample.disabled = true;
      btnClearQueue.disabled = true;
      
      // Setup progress bar details
      progressCard.classList.remove('hidden');
      
      const total = prompts.length;
      const index = state.currentIndex;
      const currentPromptText = prompts[index] ? prompts[index].text : '';
      
      activePromptTitle.textContent = currentPromptText;
      activePromptTitle.setAttribute('data-tooltip', currentPromptText);
      activeProgressIndex.textContent = `${index + 1} / ${total}`;
      
      // Compute percentage based on completed and failed prompts
      const finishedCount = prompts.filter(p => p.status === 'done' || p.status === 'failed').length;
      const pct = total > 0 ? (finishedCount / total) * 100 : 0;
      progressBarFill.style.width = `${pct}%`;
      
      // Control buttons toggle
      btnCheckStart.classList.add('hidden');
      btnFillOnly.classList.add('hidden');
      btnClearForm.classList.add('hidden');
      btnPromptOnly.classList.add('hidden');
      btnPause.classList.remove('hidden');
      btnStop.classList.remove('hidden');
    } 
    
    else if (state.status === 'paused') {
      promptInput.disabled = true;
      setDuration.disabled = true;
      setResolution.disabled = true;
      setRatio.disabled = true;
      setBitrate.disabled = true;

      btnAddPrompt.disabled = true;
      btnPasteCSV.disabled = true;
      btnUploadFile.disabled = true;
      btnDownloadSample.disabled = true;
      btnClearQueue.disabled = true;
      
      progressCard.classList.remove('hidden');
      
      btnCheckStart.classList.remove('hidden');
      btnCheckStart.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        Resume
      `;
      btnFillOnly.classList.add('hidden');
      btnClearForm.classList.add('hidden');
      btnPromptOnly.classList.add('hidden');
      btnPause.classList.add('hidden');
      btnStop.classList.remove('hidden');
    } 
    
    else {
      // stopped, idle, done
      promptInput.disabled = false;
      setDuration.disabled = false;
      setResolution.disabled = false;
      setRatio.disabled = false;
      setBitrate.disabled = false;

      btnAddPrompt.disabled = false;
      btnPasteCSV.disabled = false;
      btnUploadFile.disabled = false;
      btnDownloadSample.disabled = false;
      btnClearQueue.disabled = false;
      
      progressCard.classList.add('hidden');
      
      btnCheckStart.classList.remove('hidden');
      btnCheckStart.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
        Generate All
      `;
      btnFillOnly.classList.remove('hidden');
      btnClearForm.classList.remove('hidden');
      btnPromptOnly.classList.remove('hidden');
      btnPause.classList.add('hidden');
      btnStop.classList.add('hidden');
    }

    // Refresh Logs
    renderLogs(state.log);
  }

  function renderLogs(logs) {
    if (!logs || logs.length === 0) return;
    
    logsConsole.innerHTML = '';
    logs.forEach(log => {
      const line = document.createElement('div');
      line.className = 'log-line';
      
      // Color code highlights
      if (log.includes('ERROR')) {
        line.style.color = 'var(--danger-color)';
      } else if (log.includes('WARNING')) {
        line.style.color = '#f59e0b';
      } else if (log.includes('completed successfully') || log.includes('Batch completed')) {
        line.style.color = 'var(--success-color)';
      } else if (log.includes('Processing prompt') || log.includes('Job')) {
        line.style.color = 'var(--brand-color)';
      }
      
      line.textContent = log;
      logsConsole.appendChild(line);
    });
    
    // Auto Scroll console
    logsConsole.scrollTop = logsConsole.scrollHeight;
  }

  // ==========================================
  // REQUEST INTERCEPTOR SECTION
  // ==========================================

  // Tab switching logic
  function switchTab(activeTab) {
    tabBtnGenerator.classList.toggle('active', activeTab === 'generator');
    tabBtnInterceptor.classList.toggle('active', activeTab === 'interceptor');
    if (tabBtnAutomation) tabBtnAutomation.classList.toggle('active', activeTab === 'automation');

    paneGenerator.classList.toggle('hidden', activeTab !== 'generator');
    paneInterceptor.classList.toggle('hidden', activeTab !== 'interceptor');
    if (paneAutomation) paneAutomation.classList.toggle('hidden', activeTab !== 'automation');

    localStorage.setItem('active-tab', activeTab);

    if (activeTab === 'interceptor') {
      refreshInterceptorUI();
    } else if (activeTab === 'automation') {
      loadAutomationConfigAndFetch();
    }
  }

  tabBtnGenerator.addEventListener('click', () => switchTab('generator'));
  tabBtnInterceptor.addEventListener('click', () => switchTab('interceptor'));
  if (tabBtnAutomation) tabBtnAutomation.addEventListener('click', () => switchTab('automation'));

  // Restore active tab
  const savedTab = localStorage.getItem('active-tab') || 'generator';
  switchTab(savedTab);

  // Endpoint View Switcher State
  let activeEndpointView = 'picker'; // 'picker' | 'jobs'

  function setEndpointView(viewKey) {
    activeEndpointView = viewKey;
    if (viewKey === 'picker') {
      viewBtnPicker.style.border = '1px solid var(--brand-color)';
      viewBtnPicker.style.background = 'var(--brand-color-dim)';
      viewBtnPicker.style.color = 'var(--brand-color)';
      viewBtnJobs.style.border = '1px solid var(--border-color)';
      viewBtnJobs.style.background = 'rgba(255,255,255,0.03)';
      viewBtnJobs.style.color = 'var(--text-secondary)';

      groupPickerSize.classList.remove('hidden');
      groupJobsSize.classList.add('hidden');
    } else {
      viewBtnJobs.style.border = '1px solid var(--brand-color)';
      viewBtnJobs.style.background = 'var(--brand-color-dim)';
      viewBtnJobs.style.color = 'var(--brand-color)';
      viewBtnPicker.style.border = '1px solid var(--border-color)';
      viewBtnPicker.style.background = 'rgba(255,255,255,0.03)';
      viewBtnPicker.style.color = 'var(--text-secondary)';

      groupJobsSize.classList.remove('hidden');
      groupPickerSize.classList.add('hidden');
    }

    saveInterceptorConfig();
    refreshInterceptorUI();
  }

  viewBtnPicker.addEventListener('click', () => setEndpointView('picker'));
  viewBtnJobs.addEventListener('click', () => setEndpointView('jobs'));

  // Sync size and toggle updates
  interceptorPickerSizeSelect.addEventListener('change', saveInterceptorConfig);
  interceptorJobsSizeSelect.addEventListener('change', saveInterceptorConfig);
  interceptorToggle.addEventListener('change', saveInterceptorConfig);

  function saveInterceptorConfig() {
    const jobsSize = interceptorJobsSizeSelect.value;
    const pickerSize = interceptorPickerSizeSelect.value;
    const enabled = interceptorToggle.checked;
    
    chrome.runtime.sendMessage({
      action: 'updateInterceptorConfig',
      config: { 
        activeView: activeEndpointView,
        jobsSize, 
        pickerSize, 
        enabled 
      }
    }, (response) => {
      if (response && response.success) {
        updateInterceptorStatusBanner(enabled);
      }
    });
  }

  function updateInterceptorStatusBanner(enabled) {
    if (enabled) {
      interceptorStatusBanner.className = 'interceptor-status-banner listening';
      interceptorStatusText.textContent = 'Active & Listening for requests...';
    } else {
      interceptorStatusBanner.className = 'interceptor-status-banner disabled';
      interceptorStatusText.textContent = 'Interceptor disabled';
    }
  }

  // Refresh data on demand
  function refreshInterceptorUI() {
    chrome.runtime.sendMessage({ action: 'getInterceptorStatus' }, (state) => {
      if (state) {
        renderInterceptorState(state);
      }
    });
  }

  // Bind copy button
  btnCopyJson.addEventListener('click', () => {
    const key = `interceptRawJson_${activeEndpointView}`;
    chrome.storage.local.get([key, 'interceptRawJson'], (data) => {
      const raw = data[key] || (activeEndpointView === 'jobs' ? data.interceptRawJson : null);
      if (!raw) {
        alert(`No raw JSON found for ${activeEndpointView === 'jobs' ? 'Jobs History' : 'Reference Picker'}.`);
        return;
      }
      navigator.clipboard.writeText(raw).then(() => {
        const oldText = btnCopyJson.innerHTML;
        btnCopyJson.textContent = 'Copied!';
        setTimeout(() => {
          btnCopyJson.innerHTML = oldText;
        }, 1500);
      }).catch(err => {
        console.error('[HF-EXT] Copy failed:', err);
        alert('Failed to copy to clipboard.');
      });
    });
  });

  // Bind download button
  btnDownloadJson.addEventListener('click', () => {
    const key = `interceptRawJson_${activeEndpointView}`;
    chrome.storage.local.get([key, 'interceptRawJson', 'interceptState'], (data) => {
      const raw = data[key] || (activeEndpointView === 'jobs' ? data.interceptRawJson : null);
      if (!raw) {
        alert(`No raw JSON found for ${activeEndpointView === 'jobs' ? 'Jobs History' : 'Reference Picker'}.`);
        return;
      }
      const state = data.interceptState;
      const size = activeEndpointView === 'jobs' 
        ? (state?.config?.jobsSize || '200')
        : (state?.config?.pickerSize || '30');
      const timestamp = new Date().toISOString().slice(0, 10);
      const prefix = activeEndpointView === 'jobs' ? 'accessible_jobs' : 'reference_picker';
      const filename = `${prefix}_${size}_${timestamp}.json`;
      
      const blob = new Blob([raw], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  });

  // Render full interceptor view state
  function renderInterceptorState(state) {
    if (!state) return;
    
    // Sync UI settings controls
    if (state.config) {
      if (state.config.activeView) {
        activeEndpointView = state.config.activeView;
      }
      if (state.config.pickerSize) interceptorPickerSizeSelect.value = state.config.pickerSize;
      if (state.config.jobsSize || state.config.size) interceptorJobsSizeSelect.value = state.config.jobsSize || state.config.size;
      interceptorToggle.checked = state.config.enabled !== false;
      updateInterceptorStatusBanner(state.config.enabled !== false);
    }

    // Sync pill styles without triggering save loop
    if (activeEndpointView === 'picker') {
      viewBtnPicker.style.border = '1px solid var(--brand-color)';
      viewBtnPicker.style.background = 'var(--brand-color-dim)';
      viewBtnPicker.style.color = 'var(--brand-color)';
      viewBtnJobs.style.border = '1px solid var(--border-color)';
      viewBtnJobs.style.background = 'rgba(255,255,255,0.03)';
      viewBtnJobs.style.color = 'var(--text-secondary)';

      groupPickerSize.classList.remove('hidden');
      groupJobsSize.classList.add('hidden');
    } else {
      viewBtnJobs.style.border = '1px solid var(--brand-color)';
      viewBtnJobs.style.background = 'var(--brand-color-dim)';
      viewBtnJobs.style.color = 'var(--brand-color)';
      viewBtnPicker.style.border = '1px solid var(--border-color)';
      viewBtnPicker.style.background = 'rgba(255,255,255,0.03)';
      viewBtnPicker.style.color = 'var(--text-secondary)';

      groupJobsSize.classList.remove('hidden');
      groupPickerSize.classList.add('hidden');
    }

    // Retrieve active endpoint target data
    const epData = state.endpoints ? state.endpoints[activeEndpointView] : (activeEndpointView === 'jobs' ? state : null);

    if (!epData || epData.status === 'idle') {
      interceptorEmptyState.classList.remove('hidden');
      interceptorLoadingState.classList.add('hidden');
      interceptorResultsCard.classList.add('hidden');
    } else if (epData.status === 'loading') {
      interceptorEmptyState.classList.add('hidden');
      interceptorLoadingState.classList.remove('hidden');
      interceptorResultsCard.classList.add('hidden');
    } else if (epData.status === 'success') {
      interceptorEmptyState.classList.add('hidden');
      interceptorLoadingState.classList.add('hidden');
      interceptorResultsCard.classList.remove('hidden');
      
      // Update stats fields
      respStatus.textContent = epData.responseStatus ? `${epData.responseStatus} OK` : '200 OK';
      respTotal.textContent = epData.totalItems || '0';
      respTime.textContent = epData.timestamp || 'Unknown';
      
      const kbSize = (epData.size / 1024).toFixed(1);
      respSize.textContent = `${kbSize} KB`;
      
      // Render previews
      renderPreviewCards(epData.previewItems);
    } else if (epData.status === 'error') {
      interceptorEmptyState.classList.remove('hidden');
      interceptorLoadingState.classList.add('hidden');
      interceptorResultsCard.classList.add('hidden');
      alert(`Interception processing error: ${epData.error}`);
    }
  }

  // Render first few items as cards
  function renderPreviewCards(items) {
    previewList.innerHTML = '';
    if (!items || items.length === 0) {
      previewList.innerHTML = '<div style="font-size:11px; color:var(--text-muted); text-align:center; padding:15px; border:1px solid var(--border-color); border-radius:8px;">No preview items available.</div>';
      return;
    }

    items.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'preview-card';

      // Parse identifier fields
      let id = item.id || item.job_id || item.jobId || `Item #${index + 1}`;
      let status = item.status || item.state || 'N/A';
      let prompt = item.prompt || item.prompt_text || item.text || item.description || '';
      let modelName = item.model_name || item.model || '';
      let createdAt = item.created_at || item.createdAt || item.timestamp || '';
      
      if (typeof createdAt === 'number') {
        createdAt = new Date(createdAt).toLocaleString();
      }

      const shortId = typeof id === 'string' && id.length > 24 
        ? `${id.substring(0, 8)}...${id.substring(id.length - 8)}` 
        : id;

      let fieldsHtml = '';
      
      if (modelName) {
        fieldsHtml += `
          <div class="preview-field">
            <span class="preview-field-label">Model</span>
            <span class="preview-field-value">${escapeHtml(modelName)}</span>
          </div>
        `;
      }
      if (status) {
        fieldsHtml += `
          <div class="preview-field">
            <span class="preview-field-label">Status</span>
            <span class="preview-field-value"><span class="status-badge ${status.toLowerCase()}">${status}</span></span>
          </div>
        `;
      }
      if (createdAt) {
        fieldsHtml += `
          <div class="preview-field">
            <span class="preview-field-label">Created At</span>
            <span class="preview-field-value">${escapeHtml(createdAt)}</span>
          </div>
        `;
      }
      if (prompt) {
        fieldsHtml += `
          <div class="preview-field">
            <span class="preview-field-label">Prompt</span>
            <span class="preview-field-value" style="white-space: normal;" title="${escapeHtml(prompt)}">${escapeHtml(prompt)}</span>
          </div>
        `;
      }

      // Append up to 3 miscellaneous properties to keep preview compact
      let extraFields = 0;
      Object.entries(item).forEach(([key, val]) => {
        if (['id', 'job_id', 'jobId', 'status', 'state', 'prompt', 'prompt_text', 'text', 'description', 'model_name', 'model', 'created_at', 'createdAt', 'timestamp'].includes(key)) return;
        if (val && typeof val === 'object') return; // Skip nested objects
        if (extraFields < 3) {
          fieldsHtml += `
            <div class="preview-field">
              <span class="preview-field-label">${escapeHtml(key)}</span>
              <span class="preview-field-value" title="${escapeHtml(String(val))}">${escapeHtml(String(val))}</span>
            </div>
          `;
          extraFields++;
        }
      });

      card.innerHTML = `
        <div class="preview-card-header">
          <span class="preview-card-title">${escapeHtml(String(shortId))}</span>
          <span class="queue-item-index">#${index + 1}</span>
        </div>
        <div class="preview-card-body">
          ${fieldsHtml}
        </div>
        <button class="preview-card-expand-btn" data-expanded="false" type="button">
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.2s;"><polyline points="6 9 12 15 18 9"></polyline></svg>
          Show Raw JSON
        </button>
        <div class="preview-raw-json hidden"></div>
      `;

      // Expand raw JSON button wiring
      const expandBtn = card.querySelector('.preview-card-expand-btn');
      const rawContainer = card.querySelector('.preview-raw-json');
      const arrowIcon = expandBtn.querySelector('svg');
      
      expandBtn.addEventListener('click', () => {
        const isExpanded = expandBtn.getAttribute('data-expanded') === 'true';
        if (isExpanded) {
          expandBtn.setAttribute('data-expanded', 'false');
          expandBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.2s;"><polyline points="6 9 12 15 18 9"></polyline></svg>
            Show Raw JSON
          `;
          rawContainer.classList.add('hidden');
        } else {
          expandBtn.setAttribute('data-expanded', 'true');
          expandBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.2s; transform: rotate(180deg);"><polyline points="6 9 12 15 18 9"></polyline></svg>
            Hide Raw JSON
          `;
          rawContainer.textContent = JSON.stringify(item, null, 2);
          rawContainer.classList.remove('hidden');
        }
      });

      previewList.appendChild(card);
    });
  }

  // Redirect and reload page action
  function redirectAndReloadHiggsfield() {
    const targetUrl = 'https://higgsfield.ai/ai/video';
    
    // Disable buttons during transition to prevent double clicks
    btnRedirectReload.disabled = true;
    btnEmptyRedirectReload.disabled = true;
    
    chrome.tabs.query({}, (tabs) => {
      // Look for any tab containing higgsfield.ai
      const existingTab = tabs.find(tab => tab.url && tab.url.includes('higgsfield.ai'));
      
      if (existingTab) {
        // If tab exists, redirect to video panel, activate it, and reload it
        chrome.tabs.update(existingTab.id, { url: targetUrl, active: true }, () => {
          chrome.tabs.reload(existingTab.id);
          // Enable buttons again
          btnRedirectReload.disabled = false;
          btnEmptyRedirectReload.disabled = false;
        });
        chrome.windows.update(existingTab.windowId, { focused: true });
      } else {
        // If tab does not exist, open or update tab
        chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs) => {
          const activeTab = activeTabs[0];
          if (activeTab && (!activeTab.url || activeTab.url === 'chrome://newtab/' || activeTab.url === 'about:blank')) {
            chrome.tabs.update(activeTab.id, { url: targetUrl }, () => {
              btnRedirectReload.disabled = false;
              btnEmptyRedirectReload.disabled = false;
            });
          } else {
            chrome.tabs.create({ url: targetUrl }, () => {
              btnRedirectReload.disabled = false;
              btnEmptyRedirectReload.disabled = false;
            });
          }
        });
      }
    });
  }

  // Bind click listeners
  btnRedirectReload.addEventListener('click', redirectAndReloadHiggsfield);
  btnEmptyRedirectReload.addEventListener('click', redirectAndReloadHiggsfield);

  // Load initial interceptor status
  refreshInterceptorUI();

  let toastTimeout;
  
  // Floating Toast Notification Helper
  function showToast(message) {
    let toast = document.getElementById('extension-toast-notification');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'extension-toast-notification';
      toast.style.cssText = `
        position: fixed;
        bottom: 16px;
        left: 50%;
        transform: translateX(-50%) translateY(20px);
        background: #181820;
        color: #f3f4f6;
        border: 1px solid #26262e;
        border-radius: 6px;
        padding: 8px 14px;
        font-size: 11px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        z-index: 999999;
        opacity: 0;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        pointer-events: none;
        max-width: 90%;
        text-align: center;
      `;
      document.body.appendChild(toast);
    }
    
    if (toastTimeout) {
      clearTimeout(toastTimeout);
    }
    
    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
    
    toastTimeout = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(20px)';
    }, 2500);
  }

  // ==========================================
  // PROMPT AUTOMATIONS SECTION
  // ==========================================

  let automationConfig = {
    apiUrl: 'http://localhost:8000',
    token: ''
  };

  // Load configuration from storage
  function loadAutomationConfig(callback) {
    chrome.storage.local.get(['automationApiUrl', 'automationToken'], (res) => {
      if (res.automationApiUrl) automationConfig.apiUrl = res.automationApiUrl;
      if (res.automationToken) automationConfig.token = res.automationToken;
      
      if (autoApiUrlInput) autoApiUrlInput.value = automationConfig.apiUrl;
      if (autoJwtTokenInput) autoJwtTokenInput.value = automationConfig.token;
      
      updateConnectionBadge();
      if (callback) callback();
    });
  }

  function updateConnectionBadge(status = null, message = null) {
    if (!autoConnectionBadge) return;
    if (status === 'connected') {
      autoConnectionBadge.className = 'status-badge done';
      autoConnectionBadge.textContent = message || 'Connected';
    } else if (status === 'error') {
      autoConnectionBadge.className = 'status-badge failed';
      autoConnectionBadge.textContent = message || 'Error';
    } else {
      if (!automationConfig.apiUrl) {
        autoConnectionBadge.className = 'status-badge';
        autoConnectionBadge.style.cssText = 'font-size: 10px; background: rgba(255,255,255,0.05); color: var(--text-muted);';
        autoConnectionBadge.textContent = 'Not Configured';
      } else {
        autoConnectionBadge.className = 'status-badge running';
        autoConnectionBadge.textContent = 'Configured';
      }
    }
  }

  // Save Config event listener
  if (btnSaveAutomationConfig) {
    btnSaveAutomationConfig.addEventListener('click', () => {
      const url = (autoApiUrlInput.value || '').trim().replace(/\/+$/, '');
      const token = (autoJwtTokenInput.value || '').trim();

      if (!url) {
        showToast('Please enter a valid Base API URL.');
        return;
      }

      automationConfig.apiUrl = url;
      automationConfig.token = token;

      chrome.storage.local.set({
        automationApiUrl: url,
        automationToken: token
      }, () => {
        showToast('Automation credentials saved!');
        fetchBackendAutomations();
      });
    });
  }

  // Toggle settings section visibility
  if (automationSettingsToggleHeader && automationSettingsCard) {
    automationSettingsToggleHeader.addEventListener('click', () => {
      automationSettingsCard.classList.toggle('hidden');
    });
  }

  // Fetch Automations from backend
  async function fetchBackendAutomations() {
    if (!automationConfig.apiUrl) {
      if (automationListContainer) {
        automationListContainer.innerHTML = '<div class="queue-empty-state">Please set your Base API URL first.</div>';
      }
      return;
    }

    if (automationListContainer) {
      automationListContainer.innerHTML = `
        <div style="text-align: center; padding: 30px 20px;">
          <div class="loading-spinner" style="margin: 0 auto 12px;"></div>
          <div style="font-size: 12px; color: var(--text-secondary); font-weight: 500;">Fetching prompt automations...</div>
        </div>
      `;
    }

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (automationConfig.token) {
        headers['Authorization'] = `Bearer ${automationConfig.token}`;
      }

      const filterVal = autoStatusFilter ? autoStatusFilter.value : 'all';
      const userFilterVal = autoUserFilter ? autoUserFilter.value.trim() : '';
      let requestUrl = `${automationConfig.apiUrl}/prompt-automations?size=50`;
      if (filterVal && filterVal !== 'all') {
        requestUrl += `&status=${encodeURIComponent(filterVal)}`;
      }
      if (userFilterVal) {
        requestUrl += `&creator_id=${encodeURIComponent(userFilterVal)}`;
      }

      const response = await fetch(requestUrl, { method: 'GET', headers });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      updateConnectionBadge('connected', 'Connected');

      const items = (result.data && result.data.prompt_automations) ? result.data.prompt_automations : [];
      currentFetchedAutomations = items;
      chrome.storage.local.set({ cachedAutomations: items });
      renderAutomationItems(items);
      
      // Update "Import All" button
      if (btnImportAllAutomations) {
        if (items.length > 0) {
          btnImportAllAutomations.classList.remove('hidden');
          btnImportAllAutomations.textContent = `Import All (${items.length})`;
        } else {
          btnImportAllAutomations.classList.add('hidden');
        }
      }
    } catch (err) {
      console.error('Fetch automations error:', err);
      updateConnectionBadge('error', 'Connection Failed');
      currentFetchedAutomations = [];
      chrome.storage.local.set({ cachedAutomations: [] });
      if (btnImportAllAutomations) btnImportAllAutomations.classList.add('hidden');
      
      if (automationListContainer) {
        automationListContainer.innerHTML = `
          <div style="background: rgba(239, 68, 68, 0.06); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 8px; padding: 20px 16px; text-align: center; margin: 10px 0;">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--danger-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto 10px; display: block;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            <div style="font-size: 13px; font-weight: 600; color: var(--danger-color); margin-bottom: 6px; line-height: 1.4;">
              Failed to fetch automations: ${escapeHtml(err.message)}
            </div>
            <div style="font-size: 11px; color: var(--text-secondary); line-height: 1.5;">
              Check Base API URL, JWT auth token, or ensure backend server is running with CORS allowed.
            </div>
          </div>
        `;
      }
    }
  }

  // Render list of fetched backend automations
  function renderAutomationItems(items) {
    if (!automationListContainer) return;

    if (!items || items.length === 0) {
      automationListContainer.innerHTML = `
        <div class="interceptor-empty-state" style="padding: 30px 20px; text-align: center;">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto 12px; display: block;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          No backend automations found matching the selected filter.
        </div>
      `;
      return;
    }

    automationListContainer.innerHTML = '';
    items.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'automation-row-card';

      const status = (item.status || 'pending').toLowerCase();
      const statusBorderColors = { pending: '#f59e0b', queue: '#60a5fa', done: 'var(--success-color)', failed: 'var(--danger-color)' };
      const borderColor = statusBorderColors[status] || 'var(--border-color)';
      card.style.cssText = `background: var(--bg-card); border: 1px solid var(--border-color); border-left: 3px solid ${borderColor}; border-radius: 8px; margin-bottom: 8px; overflow: hidden;`;

      const createdDate = item.created_at ? new Date(item.created_at).toLocaleString() : 'N/A';
      const promptText = item.prompt || '';
      const safeTitle = promptText.replace(/"/g, '&quot;');

      card.innerHTML = `
        <!-- Row Header: index · status · prompt text · chevron -->
        <div class="automation-row-header" style="display: flex; align-items: center; padding: 12px 14px; gap: 10px; cursor: pointer; user-select: none;">
          <span style="flex-shrink: 0; font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--text-muted); min-width: 18px;">${index + 1}</span>
          <span class="status-badge ${status}" style="flex-shrink: 0;">${status}</span>
          <span style="font-size: 12.5px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0;" title="${safeTitle}">${escapeHtml(promptText)}</span>
          <svg class="chevron-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </div>

        <!-- Drawer (hidden by default) -->
        <div class="automation-row-drawer hidden" style="border-top: 1px solid var(--border-color); padding: 14px; background: rgba(0,0,0,0.2);">
          <!-- Prompt -->
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted);">Prompt</span>
              <button class="text-btn btn-copy-full-prompt" type="button" style="font-size: 10px; color: var(--brand-color); background: none; border: none; cursor: pointer; padding: 0;">Copy</button>
            </div>
            <div style="font-size: 12px; color: var(--text-primary); line-height: 1.6; background: rgba(0,0,0,0.3); padding: 10px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.04); white-space: pre-wrap; word-break: break-word; max-height: 220px; overflow-y: auto;">${escapeHtml(promptText)}</div>
          </div>

          <!-- Metadata -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 10px;">
            <div style="background: rgba(255,255,255,0.03); padding: 6px 8px; border-radius: 4px;">
              <span style="color: var(--text-muted); display: block; margin-bottom: 1px;">ID</span>
              <code style="font-family: 'JetBrains Mono', monospace; color: var(--text-primary); font-size: 9px;">${escapeHtml(item.id || '')}</code>
            </div>
            <div style="background: rgba(255,255,255,0.03); padding: 6px 8px; border-radius: 4px;">
              <span style="color: var(--text-muted); display: block; margin-bottom: 1px;">Model</span>
              <span style="color: var(--text-primary); font-weight: 500;">${escapeHtml(item.model || 'N/A')}</span>
            </div>
            <div style="background: rgba(255,255,255,0.03); padding: 6px 8px; border-radius: 4px;">
              <span style="color: var(--text-muted); display: block; margin-bottom: 1px;">Creator</span>
              <span style="color: var(--text-primary); font-weight: 500;">${escapeHtml(item.creator_id || 'N/A')}</span>
            </div>
            <div style="background: rgba(255,255,255,0.03); padding: 6px 8px; border-radius: 4px;">
              <span style="color: var(--text-muted); display: block; margin-bottom: 1px;">Created</span>
              <span style="color: var(--text-primary); font-weight: 500;">${createdDate}</span>
            </div>
          </div>

          <!-- Actions -->
          <div style="display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap;">
            ${(status === 'pending' || status === 'queue') ? `
              <button class="btn primary-btn small-btn btn-import-auto" data-id="${item.id}" type="button" style="height: 28px; padding: 0 12px !important; font-size: 11px; font-weight: 600; display: flex; align-items: center; gap: 4px; flex: none;">
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Import to Queue
              </button>
            ` : ''}
            ${status !== 'done' ? `
              <button class="btn secondary-btn small-btn btn-mark-done" data-id="${item.id}" type="button" style="height: 28px; padding: 0 10px !important; font-size: 10px; flex: none;">Mark Done</button>
            ` : ''}
            ${status !== 'failed' ? `
              <button class="btn secondary-btn small-btn btn-mark-failed" data-id="${item.id}" type="button" style="height: 28px; padding: 0 10px !important; font-size: 10px; color: var(--danger-color); flex: none;">Mark Failed</button>
            ` : ''}
            <button class="btn secondary-btn small-btn btn-copy-auto-id" data-id="${item.id}" type="button" style="height: 28px; padding: 0 10px !important; font-size: 10px; flex: none;">Copy ID</button>
          </div>
        </div>
      `;

      // Header click toggles drawer
      const header = card.querySelector('.automation-row-header');
      const drawer = card.querySelector('.automation-row-drawer');
      const chevron = card.querySelector('.chevron-icon');

      function toggleDrawer() {
        const isHidden = drawer.classList.contains('hidden');
        // Accordion: collapse all other open drawers first
        if (isHidden) {
          automationListContainer.querySelectorAll('.automation-row-card').forEach(otherCard => {
            if (otherCard === card) return;
            const otherDrawer = otherCard.querySelector('.automation-row-drawer');
            const otherChevron = otherCard.querySelector('.chevron-icon');
            if (otherDrawer && !otherDrawer.classList.contains('hidden')) {
              otherDrawer.classList.add('hidden');
              if (otherChevron) otherChevron.classList.remove('rotated');
            }
          });
          drawer.classList.remove('hidden');
          if (chevron) chevron.classList.add('rotated');
        } else {
          drawer.classList.add('hidden');
          if (chevron) chevron.classList.remove('rotated');
        }
      }

      if (header && drawer) {
        header.addEventListener('click', toggleDrawer);
      }

      // Copy full prompt handler
      const btnCopyPrompt = card.querySelector('.btn-copy-full-prompt');
      if (btnCopyPrompt) {
        btnCopyPrompt.addEventListener('click', (e) => {
          e.stopPropagation();
          navigator.clipboard.writeText(promptText);
          showToast('Copied full prompt text to clipboard!');
        });
      }

      // Import handlers
      const btnImports = card.querySelectorAll('.btn-import-auto');
      btnImports.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          importAutomationToQueue(item);
        });
      });

      // Mark Done handlers
      const btnMarkDones = card.querySelectorAll('.btn-mark-done');
      btnMarkDones.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          patchAutomationStatus(item.id, 'done');
        });
      });

      // Mark Failed handlers
      const btnMarkFaileds = card.querySelectorAll('.btn-mark-failed');
      btnMarkFaileds.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          patchAutomationStatus(item.id, 'failed');
        });
      });

      // Copy ID handlers
      const btnCopyIds = card.querySelectorAll('.btn-copy-auto-id');
      btnCopyIds.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          navigator.clipboard.writeText(item.id);
          showToast('Copied Automation ID to clipboard!');
        });
      });

      automationListContainer.appendChild(card);
    });
  }

  // Import prompt item into Batch Generator queue
  function importAutomationToQueue(item) {
    chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
      const state = response || { prompts: [] };
      const currentPrompts = state.prompts || [];

      // Avoid duplicate import if prompt already in queue with same backend id
      const existing = currentPrompts.find(p => p.backendAutomationId === item.id);
      if (existing) {
        showToast('Prompt is already in the Batch Generator queue!');
        return;
      }

      const newItem = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        text: item.prompt,
        status: 'queued',
        backendAutomationId: item.id
      };

      currentPrompts.push(newItem);

      chrome.runtime.sendMessage({
        action: 'updatePrompts',
        prompts: currentPrompts
      }, (res) => {
        showToast(`Imported "${item.prompt.substring(0, 20)}..." to queue!`);
      });
    });
  }

  // Import all given automations into Batch Generator queue
  function importAllAutomationsToQueue(items) {
    if (!items || items.length === 0) return;

    chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
      const state = response || { prompts: [] };
      const currentPrompts = state.prompts || [];

      let importedCount = 0;
      let skippedCount = 0;
      
      items.forEach(item => {
        const existing = currentPrompts.find(p => p.backendAutomationId === item.id);
        if (!existing) {
          currentPrompts.push({
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            text: item.prompt,
            status: 'queued',
            backendAutomationId: item.id
          });
          importedCount++;
        } else {
          skippedCount++;
        }
      });

      if (importedCount === 0) {
        showToast('All visible prompts are already in the queue!');
        return;
      }

      chrome.runtime.sendMessage({
        action: 'updatePrompts',
        prompts: currentPrompts
      }, (res) => {
        let msg = `Imported ${importedCount} prompt${importedCount > 1 ? 's' : ''} to queue!`;
        if (skippedCount > 0) {
          msg += ` (${skippedCount} skipped, already in queue)`;
        }
        showToast(msg);
      });
    });
  }

  // Send PATCH request to backend to update automation status
  async function patchAutomationStatus(id, newStatus, assetId = null) {
    if (!automationConfig.apiUrl) return;

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (automationConfig.token) {
        headers['Authorization'] = `Bearer ${automationConfig.token}`;
      }

      const body = { status: newStatus };
      if (assetId) body.asset_id = assetId;

      const response = await fetch(`${automationConfig.apiUrl}/prompt-automations/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      showToast(`Updated automation status to ${newStatus}!`);

      // Locally update the UI for this specific item instead of refetching everything
      if (automationListContainer) {
        // Find the specific button that was clicked to locate the card
        const btn = automationListContainer.querySelector(`.btn-mark-done[data-id="${id}"], .btn-mark-failed[data-id="${id}"]`);
        if (btn) {
          const card = btn.closest('.automation-row-card');
          if (card) {
            const badge = card.querySelector('.status-badge');
            if (badge) {
              badge.className = `status-badge ${newStatus}`;
              badge.textContent = newStatus;
            }
            // Update border color
            const statusBorderColors = { pending: '#f59e0b', queue: '#60a5fa', done: 'var(--success-color)', failed: 'var(--danger-color)' };
            const borderColor = statusBorderColors[newStatus] || 'var(--border-color)';
            card.style.borderLeftColor = borderColor;
            
            // Hide the action buttons since it's no longer pending/queue
            const actionsContainer = card.querySelector('.automation-row-drawer > div:last-child');
            if (actionsContainer && (newStatus === 'done' || newStatus === 'failed')) {
              // Optionally we can remove the buttons, but for now just updating the badge is enough visual feedback
            }
          }
        }
      }
      
      // Also update it in currentFetchedAutomations array so "Import All" is accurate if they change filter
      const item = currentFetchedAutomations.find(i => i.id === id);
      if (item) {
        item.status = newStatus;
      }

    } catch (err) {
      console.error('PATCH automation error:', err);
      showToast(`Failed to update status: ${err.message}`);
    }
  }

  function loadAutomationConfigAndFetch() {
    loadAutomationConfig(() => {
      chrome.storage.local.get(['cachedAutomations'], (result) => {
        if (result.cachedAutomations && result.cachedAutomations.length > 0) {
          // Render cached items instead of hitting the network every tab switch
          currentFetchedAutomations = result.cachedAutomations;
          renderAutomationItems(currentFetchedAutomations);
          
          if (btnImportAllAutomations) {
            btnImportAllAutomations.classList.remove('hidden');
            btnImportAllAutomations.textContent = `Import All (${currentFetchedAutomations.length})`;
          }
        } else {
          // Only fetch if we have nothing cached
          fetchBackendAutomations();
        }
      });
    });
  }

  if (btnFetchAutomations) {
    btnFetchAutomations.addEventListener('click', () => {
      fetchBackendAutomations();
    });
  }

  if (autoUserFilter) {
    autoUserFilter.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        fetchBackendAutomations();
      }
    });
  }

  if (btnImportAllAutomations) {
    btnImportAllAutomations.addEventListener('click', () => {
      importAllAutomationsToQueue(currentFetchedAutomations);
    });
  }

  // Custom Status Filter Dropdown Component Handlers
  const autoStatusDropdownTrigger = document.getElementById('auto-status-dropdown-trigger');
  const autoStatusDropdownMenu = document.getElementById('auto-status-dropdown-menu');
  const autoStatusSelectedLabel = document.getElementById('auto-status-selected-label');
  const autoStatusFilterHidden = document.getElementById('auto-status-filter');

  if (autoStatusDropdownTrigger && autoStatusDropdownMenu) {
    autoStatusDropdownTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = autoStatusDropdownMenu.classList.contains('hidden');
      const chevron = autoStatusDropdownTrigger.querySelector('.chevron-icon');
      if (isHidden) {
        autoStatusDropdownMenu.classList.remove('hidden');
        if (chevron) chevron.style.transform = 'rotate(180deg)';
      } else {
        autoStatusDropdownMenu.classList.add('hidden');
        if (chevron) chevron.style.transform = 'rotate(0deg)';
      }
    });

    document.addEventListener('click', () => {
      if (!autoStatusDropdownMenu.classList.contains('hidden')) {
        autoStatusDropdownMenu.classList.add('hidden');
        const chevron = autoStatusDropdownTrigger.querySelector('.chevron-icon');
        if (chevron) chevron.style.transform = 'rotate(0deg)';
      }
    });

    const items = autoStatusDropdownMenu.querySelectorAll('.custom-dropdown-item');
    items.forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = item.getAttribute('data-value');
        const labelText = item.querySelector('span')?.textContent || val;

        items.forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');

        if (autoStatusSelectedLabel) autoStatusSelectedLabel.textContent = labelText;
        if (autoStatusFilterHidden) autoStatusFilterHidden.value = val;

        autoStatusDropdownMenu.classList.add('hidden');
        const chevron = autoStatusDropdownTrigger.querySelector('.chevron-icon');
        if (chevron) chevron.style.transform = 'rotate(0deg)';

        fetchBackendAutomations();
      });
    });
  }
});

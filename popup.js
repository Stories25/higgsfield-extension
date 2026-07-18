// Higgsfield Batch Generator Popup Logic (Side Panel)

document.addEventListener('DOMContentLoaded', () => {
  // UI Elements
  const promptInput = document.getElementById('prompt-list-input');
  
  const badge = document.getElementById('global-status-badge');
  const badgeText = document.getElementById('global-status-text');
  
  const setModel = document.getElementById('set-model');
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

  let currentStatus = 'idle';

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
    }
  });

  // Sync state changes on local storage (updates when content script or background script changes storage)
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (changes.batchState && changes.batchState.newValue) {
      updateUI(changes.batchState.newValue);
    }
  });

  // Listen to prompt textarea input updates
  promptInput.addEventListener('input', () => {
    chrome.storage.local.set({ savedPrompts: promptInput.value });
  });

  // Listen to select/input updates and save to local storage
  const selectElements = ['set-model', 'set-duration', 'set-resolution', 'set-ratio', 'set-bitrate'];
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
      model: setModel.value,
      duration: parseInt(setDuration.value, 10) || 5,
      resolution: setResolution.value,
      ratio: setRatio.value,
      bitrate: setBitrate.value
    };
  }

  // Helper: Sync values to form input elements
  function applySettingsToForm(settings) {
    if (!settings) return;
    setModel.value = settings.model || 'Enhanced Seedance 2.0 Fast';
    setDuration.value = settings.duration || 5;
    setResolution.value = settings.resolution || '720p';
    setRatio.value = settings.ratio || '16:9';
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
            <div class="queue-item-meta">
              <span class="queue-item-index">#${index + 1}</span>
              <span class="status-badge ${item.status}">${item.status}</span>
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
      setModel.disabled = true;
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
      setModel.disabled = true;
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
      setModel.disabled = false;
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
});

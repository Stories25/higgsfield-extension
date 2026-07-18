// Higgsfield Batch Generator Background Service Worker

// Enable opening the side panel when clicking the toolbar icon
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('Side panel behavior error:', error));

let batchState = {
  status: 'idle', // 'idle' | 'running' | 'paused' | 'stopped' | 'done'
  prompts: [],
  currentIndex: -1,
  settings: {
    duration: 5,
    resolution: '720p',
    ratio: '16:9',
    bitrate: 'High'
  },
  log: [],
  targetTabId: null,
  useCheck: false
};

// Load initial state from storage if it exists
chrome.storage.local.get(['batchState'], (result) => {
  if (result.batchState) {
    batchState = { ...batchState, ...result.batchState };
    
    // Legacy migration: convert array of strings to objects if needed
    if (batchState.prompts && batchState.prompts.length > 0 && typeof batchState.prompts[0] === 'string') {
      batchState.prompts = batchState.prompts.map((text, idx) => ({
        id: `${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`,
        text: text,
        status: 'queued'
      }));
    }


  }
});

function saveState() {
  chrome.storage.local.set({ batchState });
  // Broadcast state to any open popup
  chrome.runtime.sendMessage({ action: 'stateUpdated', state: batchState }).catch(() => {
    // Ignore error when popup is closed
  });
}

function addLog(message) {
  const timestamp = new Date().toLocaleTimeString();
  const logMessage = `[${timestamp}] ${message}`;
  batchState.log.push(logMessage);
  // Keep only last 200 log entries
  if (batchState.log.length > 200) {
    batchState.log.shift();
  }
  saveState();
}

// Helper to inject content script manually if needed
async function ensureContentScriptInjected(tabId) {
  try {
    // Ping content script to see if it responds
    await chrome.tabs.sendMessage(tabId, { action: 'ping' });
  } catch (err) {
    // Content script not loaded yet, inject it
    addLog('Injecting automation scripts into tab...');
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
    // Wait a brief moment for injection to finish
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// Find existing Higgsfield tab or open a new one
async function getHiggsfieldTab() {
  if (batchState.targetTabId !== null) {
    try {
      const tab = await chrome.tabs.get(batchState.targetTabId);
      return tab;
    } catch (e) {
      batchState.targetTabId = null;
    }
  }

  // Query tabs
  const tabs = await chrome.tabs.query({ url: '*://higgsfield.ai/*' });
  if (tabs.length > 0) {
    // Use the first active/open Higgsfield tab
    batchState.targetTabId = tabs[0].id;
    addLog(`Attached to existing Higgsfield tab (${tabs[0].title || 'Video Page'})`);
    saveState();
    return tabs[0];
  }

  // Open new tab
  addLog('Opening new Higgsfield tab...');
  const newTab = await chrome.tabs.create({ url: 'https://higgsfield.ai/ai/video' });
  batchState.targetTabId = newTab.id;
  saveState();

  // Wait for loading to complete
  await new Promise((resolve) => {
    function listener(tabId, info) {
      if (tabId === newTab.id && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });

  return newTab;
}

// Core Batch Execution Loop
async function processNextPrompt() {
  if (batchState.status !== 'running') {
    addLog('Generation paused or stopped.');
    return;
  }

  if (batchState.currentIndex >= batchState.prompts.length) {
    batchState.status = 'done';
    addLog('Batch completed successfully!');
    saveState();
    return;
  }

  const currentPrompt = batchState.prompts[batchState.currentIndex];
  const jobTag = `[Job ${batchState.currentIndex + 1}/${batchState.prompts.length}]`;
  let hasStartedGeneration = false;
  
  try {
    currentPrompt.status = 'running';
    saveState();

    addLog(`${jobTag} Processing prompt: "${currentPrompt.text.substring(0, 40)}${currentPrompt.text.length > 40 ? '...' : ''}"`);

    const tab = await getHiggsfieldTab();
    await ensureContentScriptInjected(tab.id);

    // 1. Ensure on Video Page
    addLog(`${jobTag} Checking if tab is on video page...`);
    const onPage = await chrome.tabs.sendMessage(tab.id, { action: 'ensureOnVideoPage' });
    if (!onPage) {
      addLog(`${jobTag} Navigated to Video Page. Waiting for load...`);
      await new Promise(r => setTimeout(r, 3000));
      await ensureContentScriptInjected(tab.id); // re-inject
    }
    
    // 2. Launch the tab-side automation pipeline (indefinite loops will live in the tab)
    addLog(`${jobTag} Triggering tab-side generation pipeline...`);
    chrome.tabs.sendMessage(tab.id, {
      action: 'runPromptPipeline',
      options: {
        promptText: currentPrompt.text,
        settings: batchState.settings,
        jobTag: jobTag,
        useCheck: batchState.useCheck
      }
    }).then((res) => {
      if (res && res.error) {
        addLog(`${jobTag} ERROR launching pipeline: ${res.error}. Pausing batch.`);
        batchState.status = 'paused';
        currentPrompt.status = 'queued';
        saveState();
      } else {
        addLog(`${jobTag} Pipeline successfully launched. Service worker enters standby.`);
      }
    }).catch(err => {
      addLog(`${jobTag} ERROR launching pipeline: ${err.message || err}. Pausing batch.`);
      batchState.status = 'paused';
      currentPrompt.status = 'queued';
      saveState();
    });

  } catch (error) {
    addLog(`${jobTag} SYSTEM ERROR (Pre-Generation): ${error.message || error}. Pausing batch.`);
    currentPrompt.status = 'queued';
    batchState.status = 'paused';
    saveState();
  }
}

// Listen to Messages from Popup and Content Scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'pipelineLog') {
    addLog(request.text);
    sendResponse({ success: true });
    return true;
  }

  else if (request.action === 'pipelineFinished') {
    if (batchState.currentIndex >= 0 && batchState.currentIndex < batchState.prompts.length) {
      const currentPrompt = batchState.prompts[batchState.currentIndex];
      const jobTag = `[Job ${batchState.currentIndex + 1}/${batchState.prompts.length}]`;
      
      if (request.status === 'done') {
        const details = Array.isArray(request.details) ? request.details : [];
        const detailsStr = details.map(d => {
          if (d.source === 'text_match') {
            return `TextMatch("${d.matchedText}" in ${d.tag}.${d.class.split(' ').join('.')})`;
          } else {
            return `SelectorMatch(${d.selector} in ${d.tag}.${d.class.split(' ').join('.')})`;
          }
        }).join(' | ');
        addLog(`${jobTag} Processing state detected (Active Count: ${details.length || 1}). Matches: [${detailsStr}]. Submitted successfully.`);
        currentPrompt.status = 'done';
      } else {
        addLog(`${jobTag} Prompt pipeline failed: ${request.errorMsg}. Skipping.`);
        currentPrompt.status = 'failed';
      }

      batchState.currentIndex++;
      saveState();
      
      if (batchState.status === 'running') {
        setTimeout(processNextPrompt, 2000);
      }
    }
    sendResponse({ success: true });
    return true;
  }

  else if (request.action === 'start') {
    if (!batchState.prompts || batchState.prompts.length === 0) {
      sendResponse({ success: false, error: 'Prompt queue is empty.' });
      return true;
    }
    
    // Reset all statuses to queued on start all
    batchState.prompts.forEach(p => p.status = 'queued');
    batchState.settings = request.settings;
    batchState.currentIndex = 0;
    batchState.status = 'running';
    batchState.log = [];
    batchState.useCheck = !!request.useCheck;
    addLog('Starting batch video generation queue...');
    saveState();
    
    // Launch execution loop asynchronously
    processNextPrompt();
    sendResponse({ success: true, state: batchState });
  } 
  
  else if (request.action === 'resume') {
    if (batchState.status === 'paused' || batchState.status === 'stopped') {
      batchState.status = 'running';
      if (batchState.currentIndex < 0) batchState.currentIndex = 0;
      
      // Reset currently running status to queued so it retries
      if (batchState.currentIndex < batchState.prompts.length) {
        batchState.prompts[batchState.currentIndex].status = 'queued';
      }
      
      addLog('Resuming batch generation...');
      saveState();
      
      processNextPrompt();
      sendResponse({ success: true, state: batchState });
    } else {
      sendResponse({ success: false, message: 'Batch is not in a resumeable state' });
    }
  } 
  
  else if (request.action === 'stop') {
    batchState.status = 'stopped';
    if (batchState.currentIndex >= 0 && batchState.currentIndex < batchState.prompts.length) {
      if (batchState.prompts[batchState.currentIndex].status === 'running') {
        batchState.prompts[batchState.currentIndex].status = 'queued';
      }
    }
    addLog('Generation process stopped.');
    saveState();
    sendResponse({ success: true, state: batchState });
  } 
  
  else if (request.action === 'pause') {
    batchState.status = 'paused';
    if (batchState.currentIndex >= 0 && batchState.currentIndex < batchState.prompts.length) {
      if (batchState.prompts[batchState.currentIndex].status === 'running') {
        batchState.prompts[batchState.currentIndex].status = 'queued';
      }
    }
    addLog('Generation process paused.');
    saveState();
    sendResponse({ success: true, state: batchState });
  } 
  
  else if (request.action === 'getStatus') {
    sendResponse(batchState);
  }

  else if (request.action === 'addPrompt') {
    const newPrompt = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: request.text,
      status: 'queued'
    };
    batchState.prompts.push(newPrompt);
    addLog(`Added prompt: "${request.text.substring(0, 30)}${request.text.length > 30 ? '...' : ''}"`);
    saveState();
    sendResponse({ success: true, state: batchState });
  }

  else if (request.action === 'bulkImport') {
    const newPrompts = request.prompts.map((text, idx) => ({
      id: `${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`,
      text: text,
      status: 'queued'
    }));
    batchState.prompts.push(...newPrompts);
    addLog(`Bulk imported ${newPrompts.length} prompts to queue.`);
    saveState();
    sendResponse({ success: true, state: batchState });
  }

  else if (request.action === 'removePrompt') {
    const index = request.index;
    if (index >= 0 && index < batchState.prompts.length) {
      const removed = batchState.prompts.splice(index, 1)[0];
      addLog(`Removed prompt #${index + 1}: "${removed.text.substring(0, 30)}${removed.text.length > 30 ? '...' : ''}"`);
      
      if (index < batchState.currentIndex) {
        batchState.currentIndex--;
      }
      
      saveState();
      sendResponse({ success: true, state: batchState });
    } else {
      sendResponse({ success: false, error: 'Invalid index.' });
    }
  }

  else if (request.action === 'clearQueue') {
    batchState.prompts = [];
    batchState.currentIndex = -1;
    batchState.status = 'idle';
    addLog('Cleared all prompts from queue.');
    saveState();
    sendResponse({ success: true, state: batchState });
  }
  
  else if (request.action === 'fillOnly') {
    batchState.settings = request.settings;
    addLog('Executing "Apply Config" task...');
    saveState();

    (async () => {
      try {
        const tab = await getHiggsfieldTab();
        await ensureContentScriptInjected(tab.id);

        addLog('Checking if tab is on video page...');
        const onPage = await chrome.tabs.sendMessage(tab.id, { action: 'ensureOnVideoPage' });
        if (!onPage) {
          addLog('Navigated to Video Page. Waiting for load...');
          await new Promise(r => setTimeout(r, 3000));
          await ensureContentScriptInjected(tab.id);
        }

        // 1. Reset Form & Clear previous texts/reference images (clears everything since no prompt is passed)
        addLog('Clearing existing prompt text and selected images...');
        await chrome.tabs.sendMessage(tab.id, { action: 'resetForm', prompt: '' });

        // 2. Log currently selected model
        const activeModel = await chrome.tabs.sendMessage(tab.id, { action: 'getSelectedModel' }).catch(() => 'Unknown');
        addLog(`Using webpage's selected model: "${activeModel}"`);

        addLog(`Applying duration: ${request.settings.duration}s...`);
        await chrome.tabs.sendMessage(tab.id, { action: 'setDuration', duration: request.settings.duration });

        addLog(`Applying resolution: "${request.settings.resolution}"...`);
        await chrome.tabs.sendMessage(tab.id, { action: 'setResolution', resolution: request.settings.resolution });

        addLog(`Applying ratio: "${request.settings.ratio}"...`);
        await chrome.tabs.sendMessage(tab.id, { action: 'setRatio', ratio: request.settings.ratio });

        addLog(`Applying bitrate: "${request.settings.bitrate}"...`);
        await chrome.tabs.sendMessage(tab.id, { action: 'setBitrate', bitrate: request.settings.bitrate });

        addLog('Configurations applied successfully!');
        sendResponse({ success: true });
      } catch (err) {
        addLog(`ERROR: Failed to apply configurations: ${err.message || err}`);
        sendResponse({ success: false, error: err.message || err });
      }
    })();
    return true;
  }
  else if (request.action === 'insertPromptOnly') {
    addLog('Executing "Insert Prompt" task...');
    saveState();

    (async () => {
      try {
        const tab = await getHiggsfieldTab();
        await ensureContentScriptInjected(tab.id);

        addLog('Checking if tab is on video page...');
        const onPage = await chrome.tabs.sendMessage(tab.id, { action: 'ensureOnVideoPage' });
        if (!onPage) {
          addLog('Navigated to Video Page. Waiting for load...');
          await new Promise(r => setTimeout(r, 3000));
          await ensureContentScriptInjected(tab.id);
        }

        // Directly call setPrompt (which clears only the textbox text once and pastes the new text)
        addLog('Entering prompt text into editor...');
        await chrome.tabs.sendMessage(tab.id, { action: 'setPrompt', prompt: request.prompt });

        addLog('Prompt text inserted successfully!');
        sendResponse({ success: true });
      } catch (err) {
        addLog(`ERROR: Failed to insert prompt: ${err.message || err}`);
        sendResponse({ success: false, error: err.message || err });
      }
    })();
    return true;
  }
  else if (request.action === 'clearForm') {
    addLog('Executing "Clear Form" task...');
    saveState();

    (async () => {
      try {
        const tab = await getHiggsfieldTab();
        await ensureContentScriptInjected(tab.id);

        addLog('Checking if tab is on video page...');
        const onPage = await chrome.tabs.sendMessage(tab.id, { action: 'ensureOnVideoPage' });
        if (!onPage) {
          addLog('Navigated to Video Page. Waiting for load...');
          await new Promise(r => setTimeout(r, 3000));
          await ensureContentScriptInjected(tab.id);
        }

        // Call resetForm with an empty string prompt to wipe out prompt box and images completely
        addLog('Clearing prompt textbox and reference images...');
        await chrome.tabs.sendMessage(tab.id, { action: 'resetForm', prompt: '' });

        addLog('Form cleared successfully!');
        sendResponse({ success: true });
      } catch (err) {
        addLog(`ERROR: Failed to clear form: ${err.message || err}`);
        sendResponse({ success: false, error: err.message || err });
      }
    })();
    return true;
  }
  
  return true; // Keep message channel open for async response
});

// Tab Close Handler
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === batchState.targetTabId) {
    batchState.targetTabId = null;
    if (batchState.status === 'running') {
      addLog('WARNING: Higgsfield tab was closed. Pausing batch. Re-open page to resume.');
      batchState.status = 'paused';
      if (batchState.currentIndex >= 0 && batchState.currentIndex < batchState.prompts.length) {
        if (batchState.prompts[batchState.currentIndex].status === 'running') {
          batchState.prompts[batchState.currentIndex].status = 'queued';
        }
      }
      saveState();
    }
  }
});

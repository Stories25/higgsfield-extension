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
    model: 'Enhanced Seedance 2.0 Fast',
    duration: 5,
    resolution: '720p',
    ratio: '16:9',
    bitrate: 'High'
  },
  log: [],
  targetTabId: null
};

// Load initial state from storage if it exists
chrome.storage.local.get(['batchState'], (result) => {
  if (result.batchState) {
    batchState = { ...batchState, ...result.batchState };
    // If it was left running, let's reset to paused/stopped or resume if appropriate.
    // For safety, if it was running, we set it to paused.
    if (batchState.status === 'running') {
      batchState.status = 'paused';
      addLog('Extension restarted: batch paused.');
      saveState();
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
    addLog('Batch processing paused or stopped.');
    return;
  }

  if (batchState.currentIndex >= batchState.prompts.length) {
    batchState.status = 'done';
    addLog('Batch completed successfully!');
    saveState();
    return;
  }

  const currentPrompt = batchState.prompts[batchState.currentIndex];
  addLog(`Processing prompt ${batchState.currentIndex + 1}/${batchState.prompts.length}: "${currentPrompt.substring(0, 40)}${currentPrompt.length > 40 ? '...' : ''}"`);
  
  try {
    const tab = await getHiggsfieldTab();
    await ensureContentScriptInjected(tab.id);

    // 1. Ensure on Video Page
    addLog('Checking if tab is on video page...');
    const onPage = await chrome.tabs.sendMessage(tab.id, { action: 'ensureOnVideoPage' });
    if (!onPage) {
      addLog('Navigated to Video Page. Waiting for load...');
      await new Promise(r => setTimeout(r, 3000));
    }

    // 2. Clear the prompt box and any selected media first (keeping only referenced media)
    addLog('Clearing existing prompt text and selected images...');
    await chrome.tabs.sendMessage(tab.id, { action: 'resetForm', prompt: currentPrompt });
    addLog('Prompt box cleared. Waiting for UI to settle...');
    await new Promise(r => setTimeout(r, 500));

    // 3. Apply settings
    addLog(`Setting model to "${batchState.settings.model}"...`);
    await chrome.tabs.sendMessage(tab.id, { action: 'setModel', model: batchState.settings.model });

    addLog(`Setting duration to ${batchState.settings.duration} seconds...`);
    await chrome.tabs.sendMessage(tab.id, { action: 'setDuration', duration: batchState.settings.duration });

    addLog(`Setting resolution to "${batchState.settings.resolution}"...`);
    await chrome.tabs.sendMessage(tab.id, { action: 'setResolution', resolution: batchState.settings.resolution });

    addLog(`Setting ratio to "${batchState.settings.ratio}"...`);
    await chrome.tabs.sendMessage(tab.id, { action: 'setRatio', ratio: batchState.settings.ratio });

    addLog(`Setting bitrate to "${batchState.settings.bitrate}"...`);
    await chrome.tabs.sendMessage(tab.id, { action: 'setBitrate', bitrate: batchState.settings.bitrate });

    // 4. Fill text prompt
    addLog('Entering text prompt...');
    await chrome.tabs.sendMessage(tab.id, { action: 'setPrompt', prompt: currentPrompt });

    // 5. Check if credits are available or if warning exists before click
    const beforeStats = await chrome.tabs.sendMessage(tab.id, { action: 'checkStatusBanners' });
    if (beforeStats && beforeStats.creditsExhausted) {
      batchState.status = 'paused';
      addLog('ERROR: Credits exhausted. Pausing batch.');
      saveState();
      return;
    }

    // 6. Click generate
    addLog('Clicking Generate button...');
    await chrome.tabs.sendMessage(tab.id, { action: 'clickGenerate' });

    // 7. Polling loop for completion & checks
    addLog('Generation started. Monitoring progress...');
    let complete = false;
    const pollInterval = 12000;
    const timeout = 300000; // 5 minutes
    const startTime = Date.now();

    while (!complete) {
      if (batchState.status !== 'running') {
        addLog('Batch interrupted while waiting for generation.');
        return;
      }

      // Check timeout
      if (Date.now() - startTime > timeout) {
        throw new Error('Generation timed out (5 minutes limit exceeded).');
      }

      await new Promise(r => setTimeout(r, pollInterval));

      // Get updated status from tab
      const statusCheck = await chrome.tabs.sendMessage(tab.id, { action: 'checkStatusBanners' });
      const activeCount = await chrome.tabs.sendMessage(tab.id, { action: 'getActiveGenerationCount' });

      if (statusCheck) {
        if (statusCheck.creditsExhausted) {
          batchState.status = 'paused';
          addLog('ERROR: Credits exhausted mid-batch. Pausing execution.');
          saveState();
          return;
        }
        if (statusCheck.nsfwDetected) {
          addLog(`WARNING: Prompt ${batchState.currentIndex + 1} flagged as NSFW/Policy violation. Skipping.`);
          break; // Skip to next
        }
        if (statusCheck.failed) {
          addLog(`WARNING: Generation failed or was refunded. Skipping.`);
          break; // Skip to next
        }
      }

      if (activeCount === 0) {
        addLog('Generation completed successfully.');
        complete = true;
      } else {
        // Broadcast periodic heartbeat to keep service worker alive
        chrome.storage.local.set({ lastHeartbeat: Date.now() });
      }
    }

    // Move to next prompt
    batchState.currentIndex++;
    saveState();
    // Continue loop
    setTimeout(processNextPrompt, 2000);

  } catch (error) {
    addLog(`ERROR at prompt index ${batchState.currentIndex + 1}: ${error.message || error}`);
    batchState.status = 'paused';
    saveState();
  }
}

// Listen to Messages from Popup and Content Scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'start') {
    batchState.prompts = request.prompts;
    batchState.settings = request.settings;
    batchState.currentIndex = 0;
    batchState.status = 'running';
    batchState.log = [];
    addLog('Starting batch video generation...');
    saveState();
    
    // Launch execution loop asynchronously
    processNextPrompt();
    sendResponse({ success: true, state: batchState });
  } 
  
  else if (request.action === 'resume') {
    if (batchState.status === 'paused' || batchState.status === 'stopped') {
      batchState.status = 'running';
      if (batchState.currentIndex < 0) batchState.currentIndex = 0;
      addLog('Resuming batch processing...');
      saveState();
      
      processNextPrompt();
      sendResponse({ success: true, state: batchState });
    } else {
      sendResponse({ success: false, message: 'Batch is not in a resumeable state' });
    }
  } 
  
  else if (request.action === 'stop') {
    batchState.status = 'stopped';
    addLog('Batch processing stopped by user.');
    saveState();
    sendResponse({ success: true, state: batchState });
  } 
  
  else if (request.action === 'pause') {
    batchState.status = 'paused';
    addLog('Batch processing paused by user.');
    saveState();
    sendResponse({ success: true, state: batchState });
  } 
  
  else if (request.action === 'getStatus') {
    sendResponse(batchState);
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

        // 2. Set settings configs
        addLog(`Applying model: "${request.settings.model}"...`);
        await chrome.tabs.sendMessage(tab.id, { action: 'setModel', model: request.settings.model });

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
      saveState();
    }
  }
});

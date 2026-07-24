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
    ratio: '21:9',
    bitrate: 'High'
  },
  log: [],
  targetTabId: null,
  useCheck: false
};

let interceptState = {
  config: {
    enabled: true,
    activeView: 'picker', // 'picker' | 'jobs'
    jobsSize: '200',
    pickerSize: '30'
  },
  endpoints: {
    jobs: {
      status: 'idle',
      url: '',
      responseStatus: null,
      timestamp: null,
      size: 0,
      totalItems: 0,
      previewItems: [],
      metadata: {},
      error: null
    },
    picker: {
      status: 'idle',
      url: '',
      responseStatus: null,
      timestamp: null,
      size: 0,
      totalItems: 0,
      previewItems: [],
      metadata: {},
      error: null
    }
  }
};

let isStateLoaded = false;
let stateLoadedResolve;
const stateLoadedPromise = new Promise((resolve) => {
  stateLoadedResolve = resolve;
});

// Load initial state from storage if it exists
chrome.storage.local.get(['batchState', 'interceptState'], (result) => {
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
  if (result.interceptState) {
    const saved = result.interceptState;
    // Migrate legacy flat interceptState format if present
    if (saved.endpoints) {
      interceptState = {
        config: { ...interceptState.config, ...saved.config },
        endpoints: {
          jobs: { ...interceptState.endpoints.jobs, ...saved.endpoints.jobs },
          picker: { ...interceptState.endpoints.picker, ...saved.endpoints.picker }
        }
      };
    } else {
      // Legacy flat format to endpoints.jobs
      interceptState.endpoints.jobs = {
        status: saved.status || 'idle',
        url: saved.url || '',
        responseStatus: saved.responseStatus || null,
        timestamp: saved.timestamp || null,
        size: saved.size || 0,
        totalItems: saved.totalItems || 0,
        previewItems: saved.previewItems || [],
        metadata: saved.metadata || {},
        error: saved.error || null
      };
      if (saved.config) {
        interceptState.config.enabled = saved.config.enabled !== false;
        interceptState.config.jobsSize = saved.config.size || '200';
      }
    }
  }
  isStateLoaded = true;
  stateLoadedResolve();
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

// Helper to stop the content script's keep-alive
async function stopTabKeepAlive() {
  if (batchState.targetTabId !== null) {
    try {
      await chrome.tabs.sendMessage(batchState.targetTabId, { action: 'stopKeepAlive' });
    } catch (e) {
      // Ignore if tab is closed or not listening
    }
  }
}


// Find existing Higgsfield tab or open a new one
async function getHiggsfieldTab() {
  if (batchState.targetTabId !== null) {
    try {
      const tab = await chrome.tabs.get(batchState.targetTabId);
      // Disable auto-discarding to prevent Chrome from unloading the background tab
      chrome.tabs.update(tab.id, { autoDiscardable: false }).catch(() => {});
      return tab;
    } catch (e) {
      batchState.targetTabId = null;
    }
  }

  // Query tabs
  const allTabs = await chrome.tabs.query({});
  const tabs = allTabs.filter(tab => tab.url && tab.url.includes('higgsfield.ai'));
  if (tabs.length > 0) {
    // Use the first active/open Higgsfield tab
    batchState.targetTabId = tabs[0].id;
    addLog(`Attached to existing Higgsfield tab (${tabs[0].title || 'Video Page'})`);
    // Disable auto-discarding to prevent Chrome from unloading the background tab
    chrome.tabs.update(tabs[0].id, { autoDiscardable: false }).catch(() => {});
    saveState();
    return tabs[0];
  }

  // Open new tab
  addLog('Opening new Higgsfield tab...');
  const newTab = await chrome.tabs.create({ url: 'https://higgsfield.ai/ai/video' });
  batchState.targetTabId = newTab.id;
  // Disable auto-discarding to prevent Chrome from unloading the background tab
  chrome.tabs.update(newTab.id, { autoDiscardable: false }).catch(() => {});
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
    stopTabKeepAlive();
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
    if (!currentPrompt.id) {
      currentPrompt.id = `prompt-${batchState.currentIndex}-${Date.now()}`;
    }

    addLog(`${jobTag} Triggering tab-side generation pipeline...`);
    chrome.tabs.sendMessage(tab.id, {
      action: 'runPromptPipeline',
      options: {
        promptText: currentPrompt.text,
        settings: batchState.settings,
        jobTag: jobTag,
        useCheck: batchState.useCheck,
        promptId: currentPrompt.id
      }
    }).then((res) => {
      if (res && res.error) {
        addLog(`${jobTag} ERROR launching pipeline: ${res.error}. Pausing batch.`);
        batchState.status = 'paused';
        currentPrompt.status = 'queued';
        saveState();
        stopTabKeepAlive();
      } else {
        addLog(`${jobTag} Pipeline successfully launched. Service worker enters standby.`);
      }
    }).catch(err => {
      addLog(`${jobTag} ERROR launching pipeline: ${err.message || err}. Pausing batch.`);
      batchState.status = 'paused';
      currentPrompt.status = 'queued';
      saveState();
      stopTabKeepAlive();
    });

  } catch (error) {
    addLog(`${jobTag} SYSTEM ERROR (Pre-Generation): ${error.message || error}. Pausing batch.`);
    currentPrompt.status = 'queued';
    batchState.status = 'paused';
    saveState();
    stopTabKeepAlive();
  }
}

// Listen to Messages from Popup and Content Scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  stateLoadedPromise.then(() => {
    if (request.action === 'interceptStart') {
      const epKey = request.endpointKey || 'jobs';
      if (interceptState.endpoints[epKey]) {
        interceptState.endpoints[epKey].status = 'loading';
      }
      chrome.storage.local.set({ interceptState });
      chrome.runtime.sendMessage({ action: 'interceptStateUpdated', state: interceptState }).catch(() => {});
      sendResponse({ success: true });
      return true;
    }

    else if (request.action === 'saveInterceptedData') {
      const { endpointKey = 'jobs', status, url, data } = request;
      try {
        const targetEp = interceptState.endpoints[endpointKey] || interceptState.endpoints.jobs;
        
        targetEp.status = 'success';
        targetEp.url = url;
        targetEp.responseStatus = status;
        targetEp.timestamp = new Date().toLocaleTimeString();
        targetEp.error = null;

        const rawJsonString = JSON.stringify(data);
        targetEp.size = rawJsonString.length;

        // Process data array/object
        let list = [];
        let total = 0;
        let metadata = {};

        if (Array.isArray(data)) {
          list = data;
          total = data.length;
          metadata = { type: 'Array' };
        } else if (data && typeof data === 'object') {
          const commonListKeys = ['jobs', 'reference_elements', 'referenceElements', 'elements', 'items', 'data', 'results', 'list', 'rows', 'records'];
          let listKey = commonListKeys.find(k => Array.isArray(data[k]));
          
          if (listKey) {
            list = data[listKey];
            total = list.length;
            metadata = { ...data };
            delete metadata[listKey];
          } else {
            const firstArrayKey = Object.keys(data).find(k => Array.isArray(data[k]));
            if (firstArrayKey) {
              list = data[firstArrayKey];
              total = list.length;
              metadata = { ...data };
              delete metadata[firstArrayKey];
            } else {
              list = [data];
              total = 1;
              metadata = {};
            }
          }
        }

        targetEp.totalItems = total;
        targetEp.previewItems = list.slice(0, 3);
        targetEp.metadata = metadata;

        const epName = endpointKey === 'jobs' ? 'Jobs History' : 'Reference Picker';
        addLog(`[Interceptor] Captured ${epName} response (${total} items, ${(targetEp.size / 1024).toFixed(1)} KB)`);

        const storageUpdate = { interceptState };
        storageUpdate[`interceptRawJson_${endpointKey}`] = rawJsonString;
        if (endpointKey === 'jobs') {
          storageUpdate.interceptRawJson = rawJsonString; // Backwards compatibility
        }

        chrome.storage.local.set(storageUpdate);
        chrome.runtime.sendMessage({ action: 'interceptStateUpdated', state: interceptState }).catch(() => {});
        sendResponse({ success: true });
      } catch (err) {
        const targetEp = interceptState.endpoints[endpointKey] || interceptState.endpoints.jobs;
        targetEp.status = 'error';
        targetEp.error = err.message || 'Unknown processing error';
        chrome.storage.local.set({ interceptState });
        chrome.runtime.sendMessage({ action: 'interceptStateUpdated', state: interceptState }).catch(() => {});
        sendResponse({ success: false, error: err.message });
      }
      return true;
    }

    else if (request.action === 'updateInterceptorConfig') {
      interceptState.config = { ...interceptState.config, ...request.config };
      chrome.storage.local.set({ interceptState });
      
      // Notify active tabs of size change
      chrome.tabs.query({}).then(allTabs => {
        const tabs = allTabs.filter(tab => tab.url && tab.url.includes('higgsfield.ai'));
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { 
            action: 'updateInterceptorSize', 
            jobsSize: interceptState.config.jobsSize,
            pickerSize: interceptState.config.pickerSize,
            enabled: interceptState.config.enabled
          }).catch(() => {});
        });
      });
      
      sendResponse({ success: true, state: interceptState });
      return true;
    }

    else if (request.action === 'getInterceptorStatus') {
      sendResponse(interceptState);
      return true;
    }

    else if (request.action === 'pipelineLog') {
      addLog(request.text);
      sendResponse({ success: true });
      return true;
    }

    else if (request.action === 'pipelineFinished') {
      if (batchState.currentIndex >= 0 && batchState.currentIndex < batchState.prompts.length) {
        const currentPrompt = batchState.prompts[batchState.currentIndex];
        const jobTag = `[Job ${batchState.currentIndex + 1}/${batchState.prompts.length}]`;
        
        // Guard against stale/out-of-order pipelineFinished messages
        if (request.promptId && currentPrompt.id && request.promptId !== currentPrompt.id) {
          addLog(`${jobTag} [System Warning] Ignored stale pipelineFinished message (id: ${request.promptId}) for current prompt (id: ${currentPrompt.id}).`);
          sendResponse({ success: true, ignored: true });
          return true;
        }

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

        if (currentPrompt.backendAutomationId) {
          syncBackendAutomationStatus(currentPrompt.backendAutomationId, currentPrompt.status);
        }

        batchState.currentIndex++;
        saveState();
        
        if (batchState.status === 'running') {
          processNextPrompt();
        } else {
          stopTabKeepAlive();
        }
      } else {
        stopTabKeepAlive();
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
      stopTabKeepAlive();
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
      stopTabKeepAlive();
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
    else if (request.action === 'updatePrompts') {
      batchState.prompts = request.prompts;
      addLog(`Queue updated directly. Total prompts: ${batchState.prompts.length}`);
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
  });
  return true; // Keep message channel open for async response
});

// Tab Close Handler
chrome.tabs.onRemoved.addListener((tabId) => {
  stateLoadedPromise.then(() => {
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
});

// Sync automation status to backend API
function syncBackendAutomationStatus(automationId, status) {
  if (!automationId) return;
  chrome.storage.local.get(['automationApiUrl', 'automationToken'], (res) => {
    const apiUrl = res.automationApiUrl;
    const token = res.automationToken;
    if (!apiUrl) return;

    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const targetUrl = `${apiUrl.replace(/\/+$/, '')}/prompt-automations/${automationId}`;
    fetch(targetUrl, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status })
    }).then(res => {
      if (res.ok) {
        addLog(`[Backend Sync] Updated backend prompt automation ${automationId} status to '${status}'.`);
      } else {
        addLog(`[Backend Sync Error] Failed to update ${automationId} (HTTP ${res.status}).`);
      }
    }).catch(err => {
      addLog(`[Backend Sync Error] ${err.message}`);
    });
  });
}

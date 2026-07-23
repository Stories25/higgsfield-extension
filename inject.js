// Main World Script for Higgsfield Request Interception
(function() {
  'use strict';
  
  console.log('[HF-Interceptor] Main-world injection active.');

  function getInterceptorConfig() {
    const jobsSize = document.documentElement.getAttribute('data-hf-interceptor-jobs-size') || '200';
    const pickerSize = document.documentElement.getAttribute('data-hf-interceptor-picker-size') || '30';
    const enabledStr = document.documentElement.getAttribute('data-hf-interceptor-enabled');
    const enabled = enabledStr !== 'false';
    return { jobsSize, pickerSize, enabled };
  }

  function getEndpointInfo(url) {
    if (!url) return null;
    const strUrl = String(url);
    if (strUrl.includes('jobs/accessible')) {
      return { key: 'jobs', name: 'Jobs History' };
    }
    if (strUrl.includes('reference-elements/picker') || strUrl.includes('reference_elements/picker')) {
      return { key: 'picker', name: 'Reference Picker' };
    }
    return null;
  }

  // 1. Intercept Fetch API
  const originalFetch = window.fetch;
  window.fetch = async function(resource, options) {
    let url = '';
    if (typeof resource === 'string') {
      url = resource;
    } else if (resource instanceof URL) {
      url = resource.href;
    } else if (resource && typeof resource === 'object' && 'url' in resource) {
      url = resource.url;
    }

    const config = getInterceptorConfig();
    const epInfo = getEndpointInfo(url);

    if (config.enabled && epInfo) {
      try {
        const urlObj = new URL(url, window.location.origin);
        const targetSize = epInfo.key === 'jobs' ? config.jobsSize : config.pickerSize;
        const originalSize = urlObj.searchParams.get('size');
        
        if (originalSize !== targetSize) {
          urlObj.searchParams.set('size', targetSize);
          const modifiedUrl = urlObj.toString();
          
          console.log(`[HF-Interceptor] Modifying ${epInfo.name} fetch size from ${originalSize || 'default'} to ${targetSize}`);
          
          if (resource instanceof Request) {
            resource = new Request(modifiedUrl, resource);
          } else {
            resource = modifiedUrl;
          }
        }
        
        window.postMessage({ type: 'HF_INTERCEPT_START', endpointKey: epInfo.key }, '*');
        
        const response = await originalFetch(resource, options);
        
        const clone = response.clone();
        clone.json().then(data => {
          window.postMessage({
            type: 'HF_INTERCEPTED_RESPONSE',
            endpointKey: epInfo.key,
            status: response.status,
            url: urlObj.toString(),
            data: data
          }, '*');
        }).catch(err => {
          console.error(`[HF-Interceptor] Error parsing ${epInfo.name} response:`, err);
        });
        
        return response;
      } catch (err) {
        console.error(`[HF-Interceptor] Error in ${epInfo.name} fetch interception:`, err);
      }
    }

    return originalFetch(resource, options);
  };

  // 2. Intercept XMLHttpRequest API
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    let finalUrl = url;
    try {
      const config = getInterceptorConfig();
      const epInfo = getEndpointInfo(url);
      
      if (config.enabled && epInfo) {
        const urlObj = new URL(url, window.location.origin);
        const targetSize = epInfo.key === 'jobs' ? config.jobsSize : config.pickerSize;
        const originalSize = urlObj.searchParams.get('size');
        
        if (originalSize !== targetSize) {
          urlObj.searchParams.set('size', targetSize);
          finalUrl = urlObj.toString();
          console.log(`[HF-Interceptor] Modifying ${epInfo.name} XHR size from ${originalSize || 'default'} to ${targetSize}`);
        }
        
        this._interceptedEpInfo = epInfo;
        this._interceptedUrl = finalUrl;
      }
    } catch (err) {
      console.error('[HF-Interceptor] Error in XHR open interception:', err);
    }

    this._url = finalUrl;
    this._method = method;
    return originalOpen.apply(this, [method, finalUrl, ...args]);
  };

  XMLHttpRequest.prototype.send = function(body) {
    if (this._interceptedEpInfo) {
      try {
        const epInfo = this._interceptedEpInfo;
        const finalUrl = this._interceptedUrl || this._url;
        
        window.postMessage({ type: 'HF_INTERCEPT_START', endpointKey: epInfo.key }, '*');
        
        this.addEventListener('load', () => {
          try {
            if (this.responseType === '' || this.responseType === 'text' || this.responseType === 'json') {
              let responseData;
              if (this.responseType === 'json') {
                responseData = this.response;
              } else {
                responseData = JSON.parse(this.responseText);
              }
              
              window.postMessage({
                type: 'HF_INTERCEPTED_RESPONSE',
                endpointKey: epInfo.key,
                status: this.status,
                url: finalUrl,
                data: responseData
              }, '*');
            }
          } catch (err) {
            console.error(`[HF-Interceptor] Error parsing ${epInfo.name} XHR response:`, err);
          }
        });
      } catch (err) {
        console.error('[HF-Interceptor] Error in XHR send interception:', err);
      }
    }
    
    return originalSend.apply(this, [body]);
  };

})();

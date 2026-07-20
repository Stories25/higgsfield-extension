// Main World Script for Higgsfield Request Interception
(function() {
  'use strict';
  
  console.log('[HF-Interceptor] Main-world injection active.');

  function getInterceptorConfig() {
    const size = document.documentElement.getAttribute('data-hf-interceptor-size') || '200';
    const enabledStr = document.documentElement.getAttribute('data-hf-interceptor-enabled');
    const enabled = enabledStr !== 'false';
    return { size, enabled };
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

    if (config.enabled && url && url.includes('/fnf/jobs/accessible')) {
      try {
        const urlObj = new URL(url, window.location.origin);
        const originalSize = urlObj.searchParams.get('size');
        
        // Only modify if it's querying size and different from target, or if size parameter is missing
        if (originalSize !== config.size) {
          urlObj.searchParams.set('size', config.size);
          const modifiedUrl = urlObj.toString();
          
          console.log(`[HF-Interceptor] Modifying fetch size parameter from ${originalSize || 'default'} to ${config.size}`);
          
          if (resource instanceof Request) {
            // Reconstruct request with new URL
            resource = new Request(modifiedUrl, resource);
          } else {
            resource = modifiedUrl;
          }
        }
        
        // Notify extension that interception/fetch has started
        window.postMessage({ type: 'HF_INTERCEPT_START' }, '*');
        
        const response = await originalFetch(resource, options);
        
        // Clone response to parse body asynchronously
        const clone = response.clone();
        clone.json().then(data => {
          window.postMessage({
            type: 'HF_INTERCEPTED_RESPONSE',
            status: response.status,
            url: urlObj.toString(),
            data: data
          }, '*');
        }).catch(err => {
          console.error('[HF-Interceptor] Error parsing intercepted fetch response:', err);
        });
        
        return response;
      } catch (err) {
        console.error('[HF-Interceptor] Error in fetch interception:', err);
      }
    }

    return originalFetch(resource, options);
  };

  // 2. Intercept XMLHttpRequest API (just in case)
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    this._url = url;
    this._method = method;
    return originalOpen.apply(this, [method, url, ...args]);
  };

  XMLHttpRequest.prototype.send = function(body) {
    const config = getInterceptorConfig();
    
    if (config.enabled && this._url && this._url.includes('/fnf/jobs/accessible')) {
      try {
        const urlObj = new URL(this._url, window.location.origin);
        const originalSize = urlObj.searchParams.get('size');
        
        if (originalSize !== config.size) {
          urlObj.searchParams.set('size', config.size);
          const modifiedUrl = urlObj.toString();
          console.log(`[HF-Interceptor] Modifying XHR size parameter from ${originalSize || 'default'} to ${config.size}`);
          
          // Re-initialize with modified URL
          originalOpen.apply(this, [this._method, modifiedUrl, true]);
        }
        
        window.postMessage({ type: 'HF_INTERCEPT_START' }, '*');
        
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
                status: this.status,
                url: urlObj.toString(),
                data: responseData
              }, '*');
            }
          } catch (err) {
            console.error('[HF-Interceptor] Error parsing intercepted XHR response:', err);
          }
        });
      } catch (err) {
        console.error('[HF-Interceptor] Error in XHR interception:', err);
      }
    }
    
    return originalSend.apply(this, [body]);
  };

})();

// Content Script for Facebook Social Police

// Selectors
const POST_SELECTOR = 'div[role="feed"] > div, div[role="article"], div[role="main"] div[role="feed"] > div, div.x1yztbdb.x1n2onr6.xh8yej3.x1ja2u2z'; 
const TEXT_SELECTOR = 'div[dir="auto"], span[dir="auto"], div.x11i5rnm.xat24cr.x1mh8g0r.x1vvkbs.xtlvy1s'; 
const PROCESSED_ATTR = 'data-social-police-processed';

let isEnabled = true;

function init() {
  console.log('Social Police: Content script loaded');
  
  chrome.storage.local.get(['is_enabled'], (result) => {
    isEnabled = result.is_enabled !== false; 
    if (isEnabled) {
      observeFeed();
    }
  });

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.is_enabled) {
      isEnabled = changes.is_enabled.newValue;
      if (isEnabled) {
        processPosts();
      } else {
        removeButtons();
      }
    }
  });
}

function observeFeed() {
  const observer = new MutationObserver((mutations) => {
    if (!isEnabled) return;

    let shouldProcess = false;
    for (const mutation of mutations) {
      if (mutation.addedNodes.length) {
        shouldProcess = true;
        break;
      }
    }
    if (shouldProcess) processPosts();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  if (isEnabled) processPosts();
}

function removeButtons() {
  const buttons = document.querySelectorAll('.sp-analyze-btn, .sp-btn-wrapper');
  buttons.forEach(btn => btn.remove());
  
  const posts = document.querySelectorAll(`[${PROCESSED_ATTR}]`);
  posts.forEach(post => post.removeAttribute(PROCESSED_ATTR));
}

function processPosts() {
  if (!isEnabled) return;

  const posts = document.querySelectorAll(POST_SELECTOR);
  
  posts.forEach(post => {
    if (post.hasAttribute(PROCESSED_ATTR)) return;
    
    // 1. Identify if this is a real post (has text or image)
    const content = extractPostContent(post);
    if (!content.text && !content.imageSrc) return;

    // 2. Find Action Bar to inject button
    const actionBar = findActionBar(post);
    
    if (actionBar) {
      injectButton(actionBar, post);
      post.setAttribute(PROCESSED_ATTR, 'true');
    }
  });

  // Fallback: Bottom-up discovery by Action Bar
  const actionBars = document.querySelectorAll('div[role="group"]');
  actionBars.forEach(bar => {
     // Basic check if it looks like a social action bar
     if (bar.querySelectorAll('div[role="button"]').length >= 2) {
       // Traverse up to find a container that hasn't been processed
       let candidate = bar.parentElement;
       let depth = 0;
       while(candidate && depth < 5) {
         if (candidate.getAttribute('role') === 'article') break;
         if (candidate.querySelector(TEXT_SELECTOR)) {
            break;
         }
         candidate = candidate.parentElement;
         depth++;
       }

       if (candidate && !candidate.hasAttribute(PROCESSED_ATTR)) {
         const content = extractPostContent(candidate);
         if (content.text || content.imageSrc) {
           injectButton(bar.parentElement, candidate); 
           candidate.setAttribute(PROCESSED_ATTR, 'true');
         }
       }
     }
  });
}

function extractPostContent(postElement) {
  // Text Extraction
  let text = '';
  
  // Priority: explicit ad-rendering roles (often used for main post text)
  const roleElements = postElement.querySelectorAll('[data-ad-rendering-role="description"], [data-ad-rendering-role="story_message"]');
  if (roleElements.length > 0) {
      roleElements.forEach(el => {
          if (el.innerText && !text.includes(el.innerText)) {
              text += el.innerText + '\n';
          }
      });
  }

  // 1. Try standard selectors if no priority text found or to supplement
  if (text.length < 10) {
      const textElements = postElement.querySelectorAll(TEXT_SELECTOR);
      
      // 2. Specialized extraction
      if (textElements.length === 0) {
          // Fallback: search for any div with dir="auto" that has text content
          const fallbackTexts = postElement.querySelectorAll('div[dir="auto"], span[dir="auto"]');
          fallbackTexts.forEach(el => {
            // Exclude hidden elements or common UI noise
            if (el.innerText && el.innerText.length > 5 && !el.closest('h2') && !el.closest('h3')) {
                 if (!text.includes(el.innerText)) {
                     text += el.innerText + '\n';
                 }
            }
          });
      } else {
          textElements.forEach(el => {
            if (el.offsetParent !== null && el.innerText.length > 5) {
               if (!text.includes(el.innerText)) {
                 text += el.innerText + '\n';
               }
            }
          });
      }
  }

  const images = postElement.querySelectorAll('img');
  let validImageSrc = null;
  let maxArea = 0;

  images.forEach(img => {
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    
    if (width > 200 && height > 200) {
      const area = width * height;
      if (area > maxArea) {
        maxArea = area;
        validImageSrc = img.src;
      }
    }
  });

  return {
    text: text.trim(),
    imageSrc: validImageSrc
  };
}

function findActionBar(post) {
    // Strategy: Look for the specific Share button role/text to anchor ourselves
    // We want the container that holds the Like/Comment/Share buttons.
    // Use strict matching to avoid "289 shares" or "2.3K likes" (Status Bar).
    
    const buttons = post.querySelectorAll('div[role="button"], span[role="button"], button');
    
    // 1. First pass: Look for "Share" or "Send" explicitly WITHOUT numbers
    for(let btn of buttons) {
        const txt = (btn.innerText || btn.getAttribute('aria-label') || '').trim();
        // Skip if contains numbers (likely status bar)
        if (/\d/.test(txt)) continue;
        
        if(txt === 'Share' || txt === 'Send' || txt === 'שתף') { // Added Hebrew 'Share' just in case, given Hebrew text in example
           let parent = btn.parentElement;
           while(parent && parent !== post) {
             // The action bar usually has 3 buttons (Like, Comment, Share)
             // We check for >= 2 buttons in the container
             const siblings = parent.querySelectorAll('div[role="button"], span[role="button"], button');
             if(siblings.length >= 2) {
                 // Double check siblings to ensure they are also actions and not statuses
                 let validActions = 0;
                 siblings.forEach(sib => {
                     const sTxt = (sib.innerText || sib.getAttribute('aria-label') || '').trim();
                     if (!/\d/.test(sTxt) && (sTxt === 'Like' || sTxt === 'Comment' || sTxt === 'Share' || sTxt === 'Send' || sTxt.includes('Like') || sTxt.includes('Comment'))) {
                         validActions++;
                     }
                 });
                 if (validActions >= 2) return parent;
             }
             parent = parent.parentElement;
           }
           // Fallback
           return btn.parentElement.parentElement;
        }
    }

    // 2. Fallback: Look for Like/Comment if Share missing
    for(let btn of buttons) {
        const txt = (btn.innerText || btn.getAttribute('aria-label') || '').trim();
        if (/\d/.test(txt)) continue;

        if(txt === 'Like' || txt === 'Comment' || txt === 'אהבתי' || txt === 'תגובה') {
           let parent = btn.parentElement;
           while(parent && parent !== post) {
             if(parent.querySelectorAll('div[role="button"], span[role="button"], button').length >= 2) {
               return parent; 
             }
             parent = parent.parentElement;
           }
           return btn.parentElement.parentElement;
        }
    }
    
    return null;
}

function findMainPostContext(postElement) {
  // 1. Find Root Container (Feed Unit or Modal)
  let container = postElement.parentElement;
  let root = null;
  
  while(container && container !== document.body) {
     if (container.getAttribute('role') === 'dialog' || 
         (container.classList.contains('x1yztbdb') && container.classList.contains('xh8yej3')) || 
         (container.parentElement && container.parentElement.getAttribute('role') === 'feed')) {
        root = container;
        break;
     }
     container = container.parentElement;
  }
  
  if (!root) return null;

  // 1a. Best Effort: Look for data-ad-rendering-role="description" (User provided structure)
  const descriptionElement = root.querySelector('[data-ad-rendering-role="description"], [data-ad-rendering-role="story_message"]');
  if (descriptionElement && descriptionElement.innerText && descriptionElement.innerText.length > 10) {
      return descriptionElement.innerText;
  }
  
  // 2. Find Main Action Bar (boundary)
  const actionBar = findActionBar(root);
  if (!actionBar) return null;
  
  // 3. Extract text before boundary
  let context = '';
  
  function traverse(node) {
    if (node === actionBar) return 'STOP';
    
    if (node.nodeType === Node.ELEMENT_NODE && node.contains(actionBar)) {
        for (let child of node.children) {
            if (traverse(child) === 'STOP') return 'STOP';
        }
    } else {
        // This node is before the action bar
        if (node.nodeType === Node.ELEMENT_NODE) {
            // Check for text content
            const texts = node.querySelectorAll('div[dir="auto"], span[dir="auto"]');
            if (texts.length > 0) {
                texts.forEach(t => {
                    if (t.innerText && t.innerText.length > 5 && !context.includes(t.innerText)) {
                         context += t.innerText + '\n';
                    }
                });
            } else if ((node.matches('div[dir="auto"]') || node.matches('span[dir="auto"]')) && node.innerText.length > 5) {
                 if (!context.includes(node.innerText)) {
                     context += node.innerText + '\n';
                 }
            }
        }
    }
  }
  
  traverse(root);
  context = context.trim();
  
  // 4. Verify we didn't just extract the comment itself (if analyzing the main post)
  const postContent = extractPostContent(postElement);
  if (postContent.text && context.includes(postContent.text)) {
      // If the context is essentially just the post text, return null
      // (We use a length heuristic to allow for some noise)
      if (Math.abs(context.length - postContent.text.length) < 50) return null;
  }
  
  return context || null;
}

function injectButton(container, postElement) {
  const btn = document.createElement('button');
  btn.className = 'sp-analyze-btn';
  btn.innerText = '👮 Analyze';
  btn.title = 'Check for misinformation and AI content';
  
  // Style adjustment to fit into the action bar seamlessly
  btn.style.marginTop = '0';
  btn.style.marginBottom = '0';
  
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    toggleAnalysis(postElement, btn);
  });

  const wrapper = document.createElement('div');
  wrapper.className = 'sp-btn-wrapper';
  // Adjust wrapper style to match flex items if needed
  wrapper.style.display = 'flex';
  wrapper.style.alignItems = 'center';
  
  wrapper.appendChild(btn);
  
  // Insert at the end of the action bar container (after "Share")
  container.appendChild(wrapper);
}

function toggleAnalysis(postElement, btn) {
  // Check if result already exists
  const overlayId = btn.getAttribute('data-sp-overlay-id');
  const existing = overlayId ? document.getElementById(overlayId) : postElement.querySelector('.sp-result-overlay');
  
  if (existing) {
    existing.remove();
    btn.innerText = '👮 Analyze';
    btn.classList.remove('sp-btn-remove');
    btn.removeAttribute('data-sp-overlay-id');
    return;
  }

  // If not existing, start analysis
  const content = extractPostContent(postElement);
  
  if (!content.text && !content.imageSrc) {
    alert('No content (text or valid image) found to analyze.');
    return;
  }

  // Attempt to find original post context (if this is a comment)
  const context = findMainPostContext(postElement);

  // Find user name
  let username = 'Unknown User';
  const headerLinks = postElement.querySelectorAll('h2 a, h3 a, h4 a, strong a, span > a[role="link"]');
  for(let link of headerLinks) {
      if(link.innerText && !link.innerText.includes('Sponsored')) {
          username = link.innerText;
          break;
      }
  }

  // ... rest of function ...
  btn.innerText = 'Analyzing...';
  btn.disabled = true;

  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
    alert('Extension connection lost. Please refresh the page to reconnect.');
    btn.disabled = false;
    btn.innerText = '👮 Analyze';
    return;
  }

  try {
    chrome.runtime.sendMessage({
      action: 'analyze_post',
      text: content.text,
      imageSrc: content.imageSrc,
      username: username,
      context: context
    }, (response) => {
      btn.disabled = false;
      
      if (chrome.runtime.lastError) {
        alert('Connection Error: ' + chrome.runtime.lastError.message + '\nPlease refresh the page.');
        btn.innerText = '👮 Analyze';
        return;
      }

      if (response && response.error) {
        alert('Error: ' + response.error);
        btn.innerText = '👮 Analyze';
      } else if (response && response.data) {
        showResultOverlay(postElement, response.data, btn, username);
      }
    });
  } catch (e) {
    alert('Extension Error: ' + e.message + '\nPlease refresh the page.');
    btn.disabled = false;
    btn.innerText = '👮 Analyze';
  }
}

function showResultOverlay(postElement, data, btn, username) {
  // Update Button State
  btn.innerText = '❌ Remove Analysis';
  btn.classList.add('sp-btn-remove');

  const existing = postElement.querySelector('.sp-result-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'sp-result-overlay';
  
  // Standardize Colors
  const RED = '#ffcccc';
  const YELLOW = '#fff3cd';
  const GREEN = '#ccffcc';

  let factBg = YELLOW; // Default (Opinion/Satire/Unknown)

  // Normalize rating string to lowercase for comparison
  const rating = (data.overall_rating || '').toLowerCase();

  // Explicit priority for colors
  if (rating.includes('opinion') || rating.includes('satire')) {
    factBg = YELLOW;
  } 
  else if (rating.includes('false') || rating.includes('misleading') || data.is_factual === false) {
    factBg = RED;
  } 
  else if (rating.includes('truthful') || rating.includes('factual') || data.is_factual === true) {
    factBg = GREEN;
  } 
  else {
    // Unknown fallback
    factBg = YELLOW;
  }

  let aiBg = YELLOW;
  if (data.ai_probability > 50) {
    aiBg = RED;
  } else if (data.ai_probability < 30) {
    aiBg = GREEN;
  }

  overlay.innerHTML = `
    <div class="sp-overlay-content">
      <h3>Analysis Result for ${username || 'Unknown User'}</h3>
      <div class="sp-section" style="background: ${factBg}">
        <strong>Fact Rating:</strong> ${data.overall_rating} <br>
        <small>${data.fact_check_details}</small>
      </div>
      <div class="sp-section" style="background: ${aiBg}">
        <strong>AI Probability:</strong> ${data.ai_probability}% <br>
        <small>${data.ai_reasoning}</small>
      </div>
      <button class="sp-close-btn">Close</button>
    </div>
  `;

  const uniqueId = 'sp-overlay-' + Math.random().toString(36).substr(2, 9);
  overlay.id = uniqueId;
  btn.setAttribute('data-sp-overlay-id', uniqueId);

  const actionBar = findActionBar(postElement);
  let targetContainer = postElement;
  
  if (actionBar) {
      targetContainer = actionBar;
  }
  
  // Traverse up to find the main unit container
  let unit = targetContainer;
  let injected = false;

  // Try to find a high-level container (Virtualization Row or Feed Unit)
  while(unit && unit.parentElement && unit.parentElement !== document.body) {
      const parent = unit.parentElement;
      // Stop if parent is the feed list or virtualization container
      if (parent.getAttribute('role') === 'feed' || parent.hasAttribute('data-virtualized') || parent.id === 'facebook') {
          // 'unit' is the item INSIDE the feed/list. Inject after 'unit'.
          if (unit.nextSibling) {
              parent.insertBefore(overlay, unit.nextSibling);
          } else {
              parent.appendChild(overlay);
          }
          injected = true;
          break;
      }
      
      // Stop if parent is the main dialog content wrapper
      if (parent.getAttribute('role') === 'dialog') {
          // 'unit' is likely the main content wrapper inside dialog.
          // Use 'unit' itself or find a suitable place.
           if (unit.nextSibling) {
              parent.insertBefore(overlay, unit.nextSibling);
          } else {
              parent.appendChild(overlay);
          }
          injected = true;
          break;
      }
      
      unit = parent;
  }

  if (!injected) {
      // Fallback: Use previous logic (append to postElement or after action bar wrapper)
       if (actionBar) {
            let container = actionBar;
            while(container.parentElement && container.parentElement !== postElement) {
                container = container.parentElement;
            }
            if (container.nextSibling) {
                postElement.insertBefore(overlay, container.nextSibling);
            } else {
                postElement.appendChild(overlay);
            }
       } else {
           postElement.appendChild(overlay);
       }
  }

  overlay.querySelector('.sp-close-btn').addEventListener('click', () => {
    overlay.remove();
    // Also reset button if closed via X
    btn.innerText = '👮 Analyze';
    btn.classList.remove('sp-btn-remove');
    btn.removeAttribute('data-sp-overlay-id');
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

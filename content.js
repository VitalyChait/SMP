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
  // 1. Try standard selectors
  let text = '';
  const textElements = postElement.querySelectorAll(TEXT_SELECTOR);
  
  // 2. Specialized extraction for "single post" views which are deeply nested
  // The provided HTML snippet shows text in divs with 'dir="auto"' and 'style="text-align: start;"'
  // and specific classes like 'xdj266r x14z9mp...'
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
    const buttons = post.querySelectorAll('div[role="button"]');
    for(let btn of buttons) {
        const txt = btn.innerText || btn.getAttribute('aria-label') || '';
        if(txt.includes('Like') || txt.includes('Comment') || txt.includes('Share')) {
           let parent = btn.parentElement;
           while(parent && parent !== post) {
             if(parent.querySelectorAll('div[role="button"]').length >= 2) {
               return parent;
             }
             parent = parent.parentElement;
           }
           return btn.parentElement.parentElement;
        }
    }
    return null;
}

function injectButton(container, postElement) {
  const btn = document.createElement('button');
  btn.className = 'sp-analyze-btn';
  btn.innerText = '👮 Analyze';
  btn.title = 'Check for misinformation and AI content';
  
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    toggleAnalysis(postElement, btn);
  });

  const wrapper = document.createElement('div');
  wrapper.className = 'sp-btn-wrapper';
  wrapper.appendChild(btn);
  container.appendChild(wrapper);
}

function toggleAnalysis(postElement, btn) {
  // Check if result already exists
  const existing = postElement.querySelector('.sp-result-overlay');
  if (existing) {
    existing.remove();
    btn.innerText = '👮 Analyze';
    btn.classList.remove('sp-btn-remove'); // Optional style change
    return;
  }

  // If not existing, start analysis
  const content = extractPostContent(postElement);
  
  if (!content.text && !content.imageSrc) {
    alert('No content (text or valid image) found to analyze.');
    return;
  }

  let username = 'Unknown User';
  const headerLinks = postElement.querySelectorAll('h2 a, h3 a, h4 a, strong a, span > a[role="link"]');
  for(let link of headerLinks) {
      if(link.innerText && !link.innerText.includes('Sponsored')) {
          username = link.innerText;
          break;
      }
  }

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
      username: username
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
        showResultOverlay(postElement, response.data, btn);
      }
    });
  } catch (e) {
    alert('Extension Error: ' + e.message + '\nPlease refresh the page.');
    btn.disabled = false;
    btn.innerText = '👮 Analyze';
  }
}

function showResultOverlay(postElement, data, btn) {
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
      <h3>Analysis Result</h3>
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

  const actionBar = findActionBar(postElement);
  if (actionBar) {
    // Attempt to find the "Like/Comment/Share" bar specifically
    // The previous logic pushed it after the "Action Bar", but "Action Bar" finding is heuristic.
    // The user wants it specifically BELOW the "Share" button/row.
    // The structure provided shows a container with comments/share counts.
    // The actual "Like/Comment/Share" buttons are usually in a sibling container below the counts.
    // We want to be at the very bottom of the post "card" structure, just before comments start.
    
    // Strategy: Look for the container that holds the buttons.
    // If actionBar is that container, append after it.
    // If actionBar is inside a wrapper that holds both counts and buttons, append to that wrapper.
    
    // Heuristic: Go up to the direct child of the main post container (role=article or feed div)
    let container = actionBar;
    while(container.parentElement && container.parentElement !== postElement) {
        container = container.parentElement;
    }
    
    // Now we are at the top-level child of the post.
    // If we append here, we are at the end of the post content.
    // This usually places it after the share button row and before comments (which are often loaded dynamically or in a separate sibling structure in some views, but usually inside the same feed unit).
    if (container.nextSibling) {
        postElement.insertBefore(overlay, container.nextSibling);
    } else {
        postElement.appendChild(overlay);
    }
  } else {
    postElement.appendChild(overlay);
  }

  overlay.querySelector('.sp-close-btn').addEventListener('click', () => {
    overlay.remove();
    // Also reset button if closed via X
    btn.innerText = '👮 Analyze';
    btn.classList.remove('sp-btn-remove');
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

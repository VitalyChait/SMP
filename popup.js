document.addEventListener('DOMContentLoaded', () => {
  const extensionToggle = document.getElementById('extensionToggle');
  const providerSelect = document.getElementById('provider');
  const apiKeyInput = document.getElementById('apiKey');
  const modelNameInput = document.getElementById('modelName');
  const saveBtn = document.getElementById('saveBtn');
  const validateBtn = document.getElementById('validateBtn');
  const statusDiv = document.getElementById('status');
  const openDashboardBtn = document.getElementById('openDashboard');

  // Load saved settings
  chrome.storage.local.get(['openai_api_key', 'ai_provider', 'ai_model', 'is_enabled'], (result) => {
    if (result.openai_api_key) {
      apiKeyInput.value = result.openai_api_key;
    }
    if (result.ai_provider) {
      providerSelect.value = result.ai_provider;
    }
    if (result.ai_model) {
      modelNameInput.value = result.ai_model;
    }
    // Default to true if undefined
    extensionToggle.checked = result.is_enabled !== false; 
  });

  // Toggle Listener
  extensionToggle.addEventListener('change', () => {
    const isEnabled = extensionToggle.checked;
    chrome.storage.local.set({ is_enabled: isEnabled }, () => {
       // Optional: Notify user or content script immediately
    });
  });

  // Save settings
  saveBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    const provider = providerSelect.value;
    const model = modelNameInput.value.trim();

    if (key) {
      chrome.storage.local.set({ 
        openai_api_key: key,
        ai_provider: provider,
        ai_model: model
      }, () => {
        statusDiv.textContent = 'Settings saved successfully!';
        statusDiv.style.color = 'green';
        setTimeout(() => { statusDiv.textContent = ''; }, 2000);
      });
    } else {
      statusDiv.textContent = 'Please enter a valid key.';
      statusDiv.style.color = 'red';
    }
  });

  // Validate Model
  validateBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    const provider = providerSelect.value;
    const model = modelNameInput.value.trim();

    if (!key) {
      statusDiv.textContent = 'Enter API Key first.';
      statusDiv.style.color = 'red';
      return;
    }

    statusDiv.textContent = 'Validating...';
    statusDiv.style.color = 'blue';
    validateBtn.disabled = true;

    chrome.runtime.sendMessage({
      action: 'validate_connection',
      apiKey: key,
      provider: provider,
      model: model
    }, (response) => {
      validateBtn.disabled = false;
      if (chrome.runtime.lastError) {
        statusDiv.textContent = 'Error: ' + chrome.runtime.lastError.message;
        statusDiv.style.color = 'red';
        return;
      }

      if (response && response.success) {
        statusDiv.textContent = 'Connection Valid! ✅';
        statusDiv.style.color = 'green';
      } else {
        statusDiv.textContent = 'Failed: ' + (response ? response.error : 'Unknown error');
        statusDiv.style.color = 'red';
      }
    });
  });

  // Open Dashboard
  openDashboardBtn.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  });
});

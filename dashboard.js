document.addEventListener('DOMContentLoaded', loadData);
document.getElementById('exportBtn').addEventListener('click', exportCSV);
document.getElementById('clearBtn').addEventListener('click', clearData);

let currentRankings = {};

async function loadData() {
  const data = await chrome.storage.local.get(['rankings']);
  currentRankings = data.rankings || {};
  
  const tbody = document.querySelector('#rankingTable tbody');
  const noData = document.getElementById('noData');
  
  tbody.innerHTML = '';
  const users = Object.values(currentRankings);
  
  if (users.length === 0) {
    noData.style.display = 'block';
    return;
  }
  
  noData.style.display = 'none';
  
  // Sort by most misinformation, then most AI
  users.sort((a, b) => b.misinformation_posts - a.misinformation_posts || b.ai_posts - a.ai_posts);

  users.forEach(user => {
    const tr = document.createElement('tr');
    
    const aiRatio = user.checked_posts ? ((user.ai_posts / user.checked_posts) * 100).toFixed(1) + '%' : '0%';
    
    tr.innerHTML = `
      <td><strong>${escapeHtml(user.username)}</strong></td>
      <td>${user.checked_posts}</td>
      <td class="${user.ai_posts > 0 ? 'score-med' : ''}">${user.ai_posts}</td>
      <td class="${user.misinformation_posts > 0 ? 'score-high' : ''}">${user.misinformation_posts}</td>
      <td>${aiRatio}</td>
    `;
    
    tbody.appendChild(tr);
  });
}

function exportCSV() {
  const users = Object.values(currentRankings);
  if (users.length === 0) {
    alert('No data to export.');
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "User Name,Posts Checked,AI Suspicions,Misinformation Count,AI Ratio\n";

  users.forEach(user => {
    const aiRatio = user.checked_posts ? (user.ai_posts / user.checked_posts).toFixed(2) : 0;
    const row = [
      `"${user.username.replace(/"/g, '""')}"`,
      user.checked_posts,
      user.ai_posts,
      user.misinformation_posts,
      aiRatio
    ].join(",");
    csvContent += row + "\n";
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "social_police_rankings.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function clearData() {
  if (confirm('Are you sure you want to clear all ranking data? This cannot be undone.')) {
    chrome.storage.local.remove(['rankings'], () => {
      loadData();
    });
  }
}

function escapeHtml(text) {
  if (!text) return text;
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


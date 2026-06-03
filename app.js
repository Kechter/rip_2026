// ================================================
// Rock im Park 2026 – Crew Planner App Logic
// ================================================

// --- State ---
let currentUser = null; // { id, name, color }
let allUsers = [];       // [{ id, name, color }]
let allVotes = [];       // [{ user_id, band_name, day, priority }]
let currentDay = 'friday';
let currentView = 'timeline';
let supabaseClient = null;
let isOnline = navigator.onLine;
let realtimeChannel = null;

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
  initSupabase();
  loadLocalState();
  registerSW();
  setupOnlineListeners();
  renderAll();
  document.getElementById('userNameInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loginUser();
  });
  // Delegated click handler for band cards and vote buttons
  document.getElementById('bandContainer').addEventListener('click', (e) => {
    const voteBtn = e.target.closest('.vote-btn');
    if (voteBtn) {
      e.stopPropagation();
      toggleVote(voteBtn.dataset.band, voteBtn.dataset.day);
      return;
    }
    const card = e.target.closest('.band-card');
    if (card && currentUser) {
      toggleVote(card.dataset.band, card.dataset.day);
    }
  });
});

// --- Service Worker ---
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

// --- Supabase ---
function initSupabase() {
  if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.anonKey) {
    showStatus('local', '💾 Lokaler Modus – richte Supabase ein für Gruppen-Sync');
    return;
  }
  try {
    if (window.supabase) {
      supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
      fetchAllData();
      subscribeRealtime();
      showStatus('online', '🟢 Verbunden – Live-Sync aktiv');
    } else {
      showStatus('local', '⚠️ Supabase konnte nicht geladen werden – Lokaler Modus');
    }
  } catch (e) {
    console.error('Supabase init error:', e);
    showStatus('local', '⚠️ Supabase Fehler – Lokaler Modus');
  }
}

async function fetchAllData() {
  if (!supabaseClient) return;
  try {
    const [usersRes, votesRes] = await Promise.all([
      supabaseClient.from('users').select('*').order('created_at'),
      supabaseClient.from('votes').select('*')
    ]);
    if (usersRes.data) {
      allUsers = usersRes.data;
      saveLocal('rip_users', allUsers);
    }
    if (votesRes.data) {
      allVotes = votesRes.data;
      saveLocal('rip_votes', allVotes);
    }
    // Re-check current user
    const savedUserId = loadLocal('rip_current_user_id');
    if (savedUserId) {
      currentUser = allUsers.find(u => u.id === savedUserId) || null;
    }
    renderAll();
    syncOfflineVotes();
  } catch (e) {
    console.error('Fetch error:', e);
  }
}

function subscribeRealtime() {
  if (!supabaseClient) return;
  realtimeChannel = supabaseClient.channel('public-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => fetchAllData())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, () => fetchAllData())
    .subscribe();
}

async function syncOfflineVotes() {
  const pending = loadLocal('rip_pending_votes') || [];
  if (!supabaseClient || pending.length === 0) return;
  for (const v of pending) {
    try {
      if (v.action === 'upsert') {
        await supabaseClient.from('votes').upsert({
          user_id: v.user_id,
          band_name: v.band_name,
          day: v.day,
          priority: v.priority
        }, { onConflict: 'user_id,band_name' });
      } else if (v.action === 'delete') {
        await supabaseClient.from('votes').delete()
          .eq('user_id', v.user_id).eq('band_name', v.band_name);
      }
    } catch (e) {
      console.error('Sync error:', e);
      return; // Keep remaining pending
    }
  }
  saveLocal('rip_pending_votes', []);
}

// --- Online/Offline ---
function setupOnlineListeners() {
  window.addEventListener('online', () => {
    isOnline = true;
    if (supabaseClient) {
      fetchAllData();
      showStatus('online', '🟢 Wieder online – Daten synchronisiert');
    }
  });
  window.addEventListener('offline', () => {
    isOnline = false;
    showStatus('offline', '📴 Offline – Änderungen werden lokal gespeichert');
  });
}

function showStatus(type, text) {
  const banner = document.getElementById('statusBanner');
  banner.className = `status-banner ${type}`;
  banner.classList.remove('hidden');
  document.getElementById('statusText').textContent = text;
  if (type === 'online') {
    setTimeout(() => banner.classList.add('hidden'), 4000);
  }
}

// --- Local Storage ---
function saveLocal(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) {}
}
function loadLocal(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
}

function loadLocalState() {
  allUsers = loadLocal('rip_users') || [];
  allVotes = loadLocal('rip_votes') || [];
  const savedUserId = loadLocal('rip_current_user_id');
  if (savedUserId) {
    currentUser = allUsers.find(u => u.id === savedUserId) || null;
  }
}

// --- User Management ---
async function loginUser() {
  const input = document.getElementById('userNameInput');
  const name = input.value.trim();
  if (!name) return;

  // Check if user exists locally
  let user = allUsers.find(u => u.name.toLowerCase() === name.toLowerCase());

  if (!user) {
    const colorIndex = allUsers.length % FESTIVAL_DATA.userColors.length;
    user = {
      id: crypto.randomUUID ? crypto.randomUUID() : 'local-' + Date.now(),
      name: name,
      color: FESTIVAL_DATA.userColors[colorIndex],
      created_at: new Date().toISOString()
    };

    // Save to Supabase
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient.from('users').insert({
          name: user.name,
          color: user.color
        }).select().single();
        if (data) user = data;
        if (error) {
          // Maybe name already exists in Supabase
          const { data: existing } = await supabaseClient.from('users')
            .select('*').ilike('name', name).single();
          if (existing) user = existing;
        }
      } catch (e) {
        console.error('User create error:', e);
      }
    }

    allUsers.push(user);
    saveLocal('rip_users', allUsers);
  }

  currentUser = user;
  saveLocal('rip_current_user_id', user.id);
  input.value = '';
  renderAll();
}

function logoutUser() {
  currentUser = null;
  saveLocal('rip_current_user_id', null);
  renderAll();
}

// --- Voting ---
async function toggleVote(bandName, day) {
  if (!currentUser) return;

  const existing = allVotes.find(
    v => v.user_id === currentUser.id && v.band_name === bandName
  );

  let newPriority;
  if (!existing) {
    newPriority = 1; // → ♥
  } else if (existing.priority === 1) {
    newPriority = 2; // → ★
  } else {
    newPriority = 0; // → remove
  }

  if (newPriority === 0) {
    // Remove vote
    allVotes = allVotes.filter(
      v => !(v.user_id === currentUser.id && v.band_name === bandName)
    );
    if (supabaseClient && isOnline) {
      supabaseClient.from('votes').delete()
        .eq('user_id', currentUser.id).eq('band_name', bandName).then(() => {});
    } else {
      addPendingVote({ action: 'delete', user_id: currentUser.id, band_name: bandName });
    }
  } else {
    if (existing) {
      existing.priority = newPriority;
    } else {
      allVotes.push({
        id: crypto.randomUUID ? crypto.randomUUID() : 'v-' + Date.now(),
        user_id: currentUser.id,
        band_name: bandName,
        day: day,
        priority: newPriority,
        created_at: new Date().toISOString()
      });
    }
    if (supabaseClient && isOnline) {
      supabaseClient.from('votes').upsert({
        user_id: currentUser.id,
        band_name: bandName,
        day: day,
        priority: newPriority
      }, { onConflict: 'user_id,band_name' }).then(() => {});
    } else {
      addPendingVote({
        action: 'upsert', user_id: currentUser.id,
        band_name: bandName, day: day, priority: newPriority
      });
    }
  }

  saveLocal('rip_votes', allVotes);
  renderBands();
  renderOverview();
  renderTogether();
}

function addPendingVote(vote) {
  const pending = loadLocal('rip_pending_votes') || [];
  // Remove any existing pending for same user+band
  const filtered = pending.filter(
    v => !(v.user_id === vote.user_id && v.band_name === vote.band_name)
  );
  filtered.push(vote);
  saveLocal('rip_pending_votes', filtered);
}

// --- Rendering ---
function renderAll() {
  renderUserSection();
  renderBands();
  renderOverview();
  renderTogether();
}

function renderUserSection() {
  const login = document.getElementById('userLogin');
  const loggedIn = document.getElementById('userLoggedIn');

  if (currentUser) {
    login.classList.add('hidden');
    loggedIn.classList.remove('hidden');

    const avatar = document.getElementById('userAvatar');
    avatar.style.backgroundColor = currentUser.color;
    avatar.textContent = currentUser.name.charAt(0).toUpperCase();
    document.getElementById('userName').textContent = currentUser.name;

    // Mini avatars of other users
    const miniContainer = document.getElementById('userListMini');
    miniContainer.innerHTML = allUsers
      .filter(u => u.id !== currentUser.id)
      .map(u => `
        <div class="mini-avatar" style="background:${u.color}">
          ${u.name.charAt(0).toUpperCase()}
          <span class="tooltip">${u.name}</span>
        </div>
      `).join('');
  } else {
    login.classList.remove('hidden');
    loggedIn.classList.add('hidden');
  }
}

function switchDay(day) {
  currentDay = day;
  document.querySelectorAll('.day-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.day === day);
  });
  renderBands();
  renderOverview();
  renderTogether();
}

function switchView(view) {
  currentView = view;
  document.querySelectorAll('.view-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.view === view);
  });
  renderBands();
}

function renderBands() {
  const container = document.getElementById('bandContainer');
  const dayData = FESTIVAL_DATA.days.find(d => d.id === currentDay);
  if (!dayData) return;

  const search = document.getElementById('searchBox').value.toLowerCase().trim();
  const filterVoted = document.getElementById('filterVoted').checked;

  let acts = dayData.acts;
  if (search) {
    acts = acts.filter(a => a.band.toLowerCase().includes(search));
  }
  if (filterVoted && currentUser) {
    const myBands = new Set(allVotes.filter(v => v.user_id === currentUser.id).map(v => v.band_name));
    acts = acts.filter(a => myBands.has(a.band));
  }

  if (currentView === 'timeline') {
    renderTimeline(container, acts, dayData.id);
  } else {
    renderStages(container, acts, dayData.id);
  }
}

function renderTimeline(container, acts, dayId) {
  // Sort by start time
  const sorted = [...acts].sort((a, b) => a.start.localeCompare(b.start));
  container.innerHTML = `<div class="band-list">${sorted.map(act =>
    renderBandCard(act, dayId, true)
  ).join('')}</div>`;
}

function renderStages(container, acts, dayId) {
  const stages = ['Utopia', 'Mandora', 'Orbit'];
  container.innerHTML = stages.map(stage => {
    const stageActs = acts.filter(a => a.stage === stage)
      .sort((a, b) => a.start.localeCompare(b.start));
    if (stageActs.length === 0) return '';
    return `
      <div class="stage-group">
        <div class="stage-header">
          <div class="stage-dot" style="background:${FESTIVAL_DATA.stageColors[stage]}"></div>
          <h3>${stage} Stage</h3>
        </div>
        <div class="band-list">
          ${stageActs.map(act => renderBandCard(act, dayId, false)).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function renderBandCard(act, dayId, showStage) {
  const bandVotes = allVotes.filter(v => v.band_name === act.band);
  const myVote = currentUser
    ? bandVotes.find(v => v.user_id === currentUser.id)
    : null;
  const votePriority = myVote ? myVote.priority : 0;

  const voteClass = votePriority === 1 ? 'voted-1' : votePriority === 2 ? 'voted-2' : '';
  const headlinerClass = act.headliner ? 'headliner' : '';

  const voterDots = bandVotes.map(v => {
    const user = allUsers.find(u => u.id === v.user_id);
    if (!user) return '';
    const mustClass = v.priority === 2 ? 'must' : '';
    return `<div class="band-voter-dot ${mustClass}" style="background:${user.color}" title="${user.name}">${user.name.charAt(0).toUpperCase()}</div>`;
  }).join('');

  const bandAttr = act.band.replace(/"/g, '&quot;');
  const voteBtn = currentUser
    ? `<button class="vote-btn ${voteClass}" data-band="${bandAttr}" data-day="${dayId}" title="Klick: ♥ will ich → ★ muss ich → entfernen">${
        votePriority === 0 ? '♡' : votePriority === 1 ? '♥' : '★'
      }</button>`
    : '';

  const stageTag = showStage
    ? `<span class="stage-tag ${act.stage.toLowerCase()}">${act.stage}</span>`
    : '';

  const headlinerBadge = act.headliner
    ? '<span class="headliner-badge">HEADLINER</span>'
    : '';

  return `
    <div class="band-card ${headlinerClass} ${voteClass}" data-stage="${act.stage}"
         data-band="${bandAttr}" data-day="${dayId}">
      <div class="band-time">${act.start} – ${act.end}</div>
      <div class="band-info">
        <div class="band-name">${escHtml(act.band)}${headlinerBadge}</div>
        <div class="timeline-meta">
          ${stageTag}
          <div class="band-voters">${voterDots}</div>
        </div>
      </div>
      ${voteBtn}
    </div>
  `;
}

function renderOverview() {
  const table = document.getElementById('overviewTable');
  const dayData = FESTIVAL_DATA.days.find(d => d.id === currentDay);
  if (!dayData || allUsers.length === 0) {
    table.innerHTML = '<tr><td class="empty-state" colspan="99">Noch keine User registriert</td></tr>';
    return;
  }

  const dayVotes = allVotes.filter(v => v.day === currentDay);
  // Only show bands that have at least 1 vote
  const votedBands = [...new Set(dayVotes.map(v => v.band_name))];
  const acts = dayData.acts
    .filter(a => votedBands.includes(a.band))
    .sort((a, b) => a.start.localeCompare(b.start));

  if (acts.length === 0) {
    table.innerHTML = '<tr><td class="empty-state" colspan="99">Noch keine Votes für diesen Tag</td></tr>';
    return;
  }

  const headerCells = allUsers.map(u =>
    `<th style="color:${u.color}">${u.name.substring(0, 4)}</th>`
  ).join('');

  const rows = acts.map(act => {
    const cells = allUsers.map(u => {
      const vote = dayVotes.find(v => v.user_id === u.id && v.band_name === act.band);
      if (!vote) return '<td></td>';
      const symbol = vote.priority === 2 ? '★' : '♥';
      const cls = vote.priority === 2 ? 'must' : 'want';
      return `<td><span class="cell-vote ${cls}">${symbol}</span></td>`;
    }).join('');
    const stageTag = `<span class="stage-tag ${act.stage.toLowerCase()}">${act.stage.charAt(0)}</span>`;
    return `<tr><td>${stageTag} ${escHtml(act.band)}</td>${cells}</tr>`;
  }).join('');

  table.innerHTML = `
    <thead><tr><th>Band</th>${headerCells}</tr></thead>
    <tbody>${rows}</tbody>
  `;
}

function renderTogether() {
  const container = document.getElementById('togetherContainer');
  const dayData = FESTIVAL_DATA.days.find(d => d.id === currentDay);
  if (!dayData || allUsers.length < 2) {
    container.innerHTML = '<div class="empty-state">Mindestens 2 User nötig</div>';
    return;
  }

  const dayVotes = allVotes.filter(v => v.day === currentDay);

  // Find groups: for each band, which users go?
  const bandGroups = {};
  dayData.acts.forEach(act => {
    const voters = dayVotes
      .filter(v => v.band_name === act.band)
      .map(v => allUsers.find(u => u.id === v.user_id))
      .filter(Boolean);
    if (voters.length >= 2) {
      const key = voters.map(u => u.id).sort().join(',');
      if (!bandGroups[key]) {
        bandGroups[key] = { users: voters, bands: [] };
      }
      bandGroups[key].bands.push(act);
    }
  });

  const groups = Object.values(bandGroups).sort((a, b) => b.users.length - a.users.length);

  if (groups.length === 0) {
    container.innerHTML = '<div class="empty-state">Noch keine gemeinsamen Bands – votet los! 🎶</div>';
    return;
  }

  container.innerHTML = groups.map(g => `
    <div class="together-card fade-in">
      <div class="together-header">
        <div class="together-users">
          ${g.users.map(u =>
            `<div class="mini-avatar" style="background:${u.color}">${u.name.charAt(0).toUpperCase()}</div>`
          ).join('')}
        </div>
        <span style="font-size:0.8rem;color:var(--text-secondary)">
          ${g.users.map(u => u.name).join(', ')}
        </span>
      </div>
      <div class="together-band-list">
        ${g.bands.map(b =>
          `<span class="together-band-tag">${b.start} ${escHtml(b.band)}</span>`
        ).join('')}
      </div>
    </div>
  `).join('');
}

// --- Utilities ---
function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

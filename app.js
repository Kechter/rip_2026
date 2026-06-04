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
let liveInterval = null;

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
  initSupabase();
  loadLocalState();
  registerSW();
  setupOnlineListeners();
  initSettings();
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
      return;
    }
    // Also delegate click for Grid acts
    const gridCard = e.target.closest('.grid-act-card');
    if (gridCard && currentUser) {
      toggleVote(gridCard.dataset.band, gridCard.dataset.day);
      return;
    }
    // Also delegate click for Agenda items
    const agendaItem = e.target.closest('.agenda-item');
    if (agendaItem && currentUser) {
      toggleVote(agendaItem.dataset.band, agendaItem.dataset.day);
      return;
    }
    // Also delegate click for My Plan cards
    const myplanCard = e.target.closest('.myplan-card');
    if (myplanCard && currentUser) {
      toggleVote(myplanCard.dataset.band, myplanCard.dataset.day);
      return;
    }
  });

  // Start a clock tick to refresh views (like the red Grid Live line)
  liveInterval = setInterval(() => {
    if (currentView === 'grid') {
      renderBands();
    }
  }, 60000);
});

// --- Settings Management ---
function initSettings() {
  // Render color picker palette
  const palette = document.getElementById('colorPalette');
  if (palette) {
    palette.innerHTML = FESTIVAL_DATA.userColors.map(color => `
      <div class="color-dot" style="background:${color}" onclick="changeUserColor('${color}')" data-color="${color}"></div>
    `).join('');
  }

  // Load compact mode preference
  const isCompact = loadLocal('rip_compact_mode') || false;
  document.getElementById('compactModeCheckbox').checked = isCompact;
  toggleCompactMode(isCompact);
}

function getShortName(userName) {
  if (!userName) return "";
  const name = userName.trim();
  
  // Find all user names in memory
  const names = allUsers.map(u => u.name.trim());
  const conflicts = names.filter(n => n.toLowerCase() !== name.toLowerCase() && n.charAt(0).toLowerCase() === name.charAt(0).toLowerCase());
  
  if (conflicts.length === 0) {
    return name.charAt(0).toUpperCase();
  }
  
  // Check if first two characters match
  const twoCharConflicts = conflicts.filter(n => n.substring(0, 2).toLowerCase() === name.substring(0, 2).toLowerCase());
  if (twoCharConflicts.length === 0) {
    return name.substring(0, 2).toUpperCase().charAt(0) + name.substring(0, 2).toLowerCase().charAt(1);
  }
  
  // Fallback to 3 characters
  return name.substring(0, 3).toUpperCase().charAt(0) + name.substring(0, 3).toLowerCase().substring(1, 3);
}

function toggleSettings(open) {
  const drawer = document.getElementById('settingsDrawer');
  if (open) {
    drawer.classList.remove('hidden');
    
    // Populate current name input
    if (currentUser) {
      document.getElementById('renameInput').value = currentUser.name;
    }
    
    // Highlight current active color
    if (currentUser) {
      document.querySelectorAll('.color-dot').forEach(dot => {
        dot.classList.toggle('active', dot.dataset.color.toLowerCase() === currentUser.color.toLowerCase());
        dot.textContent = dot.dataset.color.toLowerCase() === currentUser.color.toLowerCase() ? '✓' : '';
      });
    }

    renderSettingsUserList();
  } else {
    drawer.classList.add('hidden');
  }
}

// Render list of users in settings panel for management
function renderSettingsUserList() {
  const container = document.getElementById('settingsUserList');
  if (!container) return;

  if (allUsers.length <= 1) {
    container.innerHTML = `<div class="empty-state" style="padding:10px 0;">Keine anderen Crew-Mitglieder registriert.</div>`;
    return;
  }

  container.innerHTML = allUsers
    .filter(u => !currentUser || u.id !== currentUser.id)
    .map(u => `
      <div class="settings-user-row">
        <div class="settings-user-info">
          <div class="settings-user-avatar" style="background:${u.color}">${getShortName(u.name)}</div>
          <span>${escHtml(u.name)}</span>
        </div>
        <button class="settings-delete-btn" onclick="deleteUser('${u.id}')" title="User löschen">🗑️</button>
      </div>
    `).join('');
}

// Rename the current user
async function renameCurrentUser() {
  const input = document.getElementById('renameInput');
  const newName = input.value.trim();
  if (!newName || !currentUser) return;

  const oldName = currentUser.name;
  currentUser.name = newName;

  // Save locally
  const uIdx = allUsers.findIndex(u => u.id === currentUser.id);
  if (uIdx !== -1) {
    allUsers[uIdx].name = newName;
    saveLocal('rip_users', allUsers);
  }

  // Update Supabase
  if (supabaseClient) {
    try {
      await supabaseClient.from('users').update({ name: newName }).eq('id', currentUser.id);
    } catch (e) {
      console.error('Failed to rename user on Supabase:', e);
    }
  }

  renderAll();
  renderSettingsUserList();
  showStatus('online', `Namensänderung gespeichert: ${newName}`);
}

// Delete user from local/remote DB
async function deleteUser(userId) {
  if (!confirm("Möchtest du dieses Crew-Mitglied wirklich löschen? Alle Votes dieser Person gehen verloren.")) return;

  // Filter local state
  allUsers = allUsers.filter(u => u.id !== userId);
  allVotes = allVotes.filter(v => v.user_id !== userId);
  
  saveLocal('rip_users', allUsers);
  saveLocal('rip_votes', allVotes);

  // Remove from Supabase
  if (supabaseClient) {
    try {
      await Promise.all([
        supabaseClient.from('users').delete().eq('id', userId),
        supabaseClient.from('votes').delete().eq('user_id', userId)
      ]);
    } catch (e) {
      console.error('Failed to delete user from Supabase:', e);
    }
  }

  renderAll();
  renderSettingsUserList();
}

async function changeUserColor(color) {
  if (!currentUser) return;
  currentUser.color = color;
  
  // Highlight active
  document.querySelectorAll('.color-dot').forEach(dot => {
    dot.classList.toggle('active', dot.dataset.color === color);
    dot.textContent = dot.dataset.color === color ? '✓' : '';
  });

  // Save locally
  const uIdx = allUsers.findIndex(u => u.id === currentUser.id);
  if (uIdx !== -1) {
    allUsers[uIdx].color = color;
    saveLocal('rip_users', allUsers);
  }

  // Update Supabase
  if (supabaseClient) {
    try {
      await supabaseClient.from('users').update({ color: color }).eq('id', currentUser.id);
    } catch (e) {
      console.error('Failed to update color on Supabase:', e);
    }
  }

  renderAll();
}

function toggleCompactMode(enable) {
  if (enable) {
    document.body.classList.add('compact-mode');
  } else {
    document.body.classList.remove('compact-mode');
  }
  saveLocal('rip_compact_mode', enable);
}



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
  
  // Initialize checkin broadcast channel
  subscribeCheckinBroadcast();
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
    avatar.textContent = getShortName(currentUser.name);
    document.getElementById('userName').textContent = currentUser.name;

    // Mini avatars of other users
    const miniContainer = document.getElementById('userListMini');
    if (miniContainer) {
      miniContainer.innerHTML = allUsers
        .filter(u => u.id !== currentUser.id)
        .map(u => `
          <div class="mini-avatar" style="background:${u.color}">
            ${getShortName(u.name)}
            <span class="tooltip">${u.name}</span>
          </div>
        `).join('');
    }
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



// --- Additional state for Grid check-in ---
let activeCheckins = {}; // { user_id: { band_name, day } }

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

  const searchBox = document.getElementById('searchBox');
  searchBox.classList.remove('hidden');

  switch(currentView) {
    case 'timeline':
      renderTimeline(container, acts, dayData.id);
      break;
    case 'stages':
      renderStages(container, acts, dayData.id);
      break;
    case 'grid':
      renderGrid(container, acts, dayData.id);
      break;
  }
}

// --- Check-in Handler ---
function toggleCheckin(bandName, dayId, event) {
  if (event) event.stopPropagation();
  if (!currentUser) return;

  const currentCheck = activeCheckins[currentUser.id];
  if (currentCheck && currentCheck.band_name === bandName && currentCheck.day === dayId) {
    // Check out
    delete activeCheckins[currentUser.id];
  } else {
    // Check in
    activeCheckins[currentUser.id] = { band_name: bandName, day: dayId };
  }

  // Push checkins to localStorage
  saveLocal('rip_active_checkins', activeCheckins);

  // Sync to other users if online
  if (supabaseClient) {
    // For now we simulate with localStorage. For true Supabase sync we could use broadcast channels
    if (realtimeChannel) {
      realtimeChannel.send({
        type: 'broadcast',
        event: 'checkin',
        payload: { user_id: currentUser.id, checkin: activeCheckins[currentUser.id] }
      });
    }
  }

  renderBands();
}

// Subscribe to checkin broadcast
function subscribeCheckinBroadcast() {
  if (!supabaseClient || !realtimeChannel) return;
  realtimeChannel.on('broadcast', { event: 'checkin' }, ({ payload }) => {
    if (payload.checkin) {
      activeCheckins[payload.user_id] = payload.checkin;
    } else {
      delete activeCheckins[payload.user_id];
    }
    renderBands();
  });
}

// --- View Helpers ---

// 1. Grid (Clashfinder) View Helper
function renderGrid(container, acts, dayId) {
  const stages = ['Utopia', 'Mandora', 'Orbit'];
  
  // Math parameters
  const startHour = 12; // 12:00
  const endHour = 27;   // 03:00 next day
  const totalMinutes = (endHour - startHour) * 60;
  const pixelsPerMinute = 1.25; // 1.25px per minute height

  // Time conversion helper
  const timeToMinutes = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    let mins = h * 60 + m;
    if (h < startHour) mins += 24 * 60;
    return mins - startHour * 60;
  };

  // 1. Render Current Time Line
  let liveLineHtml = '';
  const now = new Date();
  const currentHours = now.getHours();
  const currentMins = now.getMinutes();
  const currentVal = (currentHours < startHour ? currentHours + 24 : currentHours) * 60 + currentMins;
  const startVal = startHour * 60;
  const endVal = endHour * 60;
  
  if (currentVal >= startVal && currentVal < endVal) {
    const relativeMins = currentVal - startVal;
    const topPos = relativeMins * pixelsPerMinute;
    liveLineHtml = `<div class="grid-live-line" style="top: ${topPos}px"></div>`;
  }

  // Load checkins
  const savedCheckins = loadLocal('rip_active_checkins');
  if (savedCheckins) activeCheckins = savedCheckins;

  // Generate vertical grid labels
  let timeLabelsHtml = '';
  for (let h = startHour; h <= endHour; h++) {
    const displayHour = h >= 24 ? h - 24 : h;
    const padHour = String(displayHour).padStart(2, '0') + ':00';
    const topPos = (h - startHour) * 60 * pixelsPerMinute;
    timeLabelsHtml += `<div class="grid-time-label" style="top: ${topPos}px">${padHour}</div>`;
  }

  // Render headers
  let headersHtml = '<div class="grid-header-cell time-header">Zeit</div>';
  stages.forEach(stage => {
    headersHtml += `<div class="grid-header-cell">${stage}</div>`;
  });

  // Render columns content
  let columnsHtml = `<div class="grid-timeline-col" style="height: ${totalMinutes * pixelsPerMinute}px">${timeLabelsHtml}${liveLineHtml}</div>`;
  
  stages.forEach(stage => {
    const stageActs = acts.filter(a => a.stage === stage);
    let cardsHtml = '';
    
    stageActs.forEach(act => {
      const startMin = timeToMinutes(act.start);
      const endMin = timeToMinutes(act.end);
      const height = (endMin - startMin) * pixelsPerMinute;
      const top = startMin * pixelsPerMinute;
      
      const bandVotes = allVotes.filter(v => v.band_name === act.band);
      const myVote = currentUser ? bandVotes.find(v => v.user_id === currentUser.id) : null;
      const votePriority = myVote ? myVote.priority : 0;
      const voteClass = votePriority === 1 ? 'voted-1' : votePriority === 2 ? 'voted-2' : '';
      
      // Voter Dots
      const voterDots = bandVotes.map(v => {
        const user = allUsers.find(u => u.id === v.user_id);
        if (!user) return '';
        
        // Check if this voter is checked-in at this stage right now
        const isCheckedIn = activeCheckins[v.user_id] && 
                            activeCheckins[v.user_id].band_name === act.band && 
                            activeCheckins[v.user_id].day === dayId;
        const checkinClass = isCheckedIn ? 'checked-in-user' : '';
        const checkinSymbol = isCheckedIn ? '📍' : '';
        
        return `<div class="grid-voter-dot ${checkinClass}" style="background:${user.color}" title="${user.name} ${checkinSymbol ? '(Vor Ort)' : ''}">${getShortName(user.name)}</div>`;
      }).join('');
      
      const bandAttr = act.band.replace(/"/g, '&quot;');
      
      // Checkin button for currentUser if this act is favorited
      let checkinBtnHtml = '';
      if (currentUser && myVote) {
        const isCheckedIn = activeCheckins[currentUser.id] && 
                            activeCheckins[currentUser.id].band_name === act.band && 
                            activeCheckins[currentUser.id].day === dayId;
        const btnClass = isCheckedIn ? 'checked-in' : '';
        const btnLabel = isCheckedIn ? '📍 Da!' : '📍 Hier?';
        checkinBtnHtml = `<button class="grid-checkin-btn ${btnClass}" onclick="toggleCheckin('${bandAttr}', '${dayId}', event)">${btnLabel}</button>`;
      }
      
      cardsHtml += `
        <div class="grid-act-card ${voteClass}" style="top: ${top}px; height: ${height}px;" data-band="${bandAttr}" data-day="${dayId}">
          <div>
            <div class="grid-act-name">${escHtml(act.band)}</div>
            <div class="grid-act-time">${act.start}–${act.end}</div>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:flex-end;">
            ${checkinBtnHtml}
            <div class="grid-act-voters">${voterDots}</div>
          </div>
        </div>
      `;
    });
    
    columnsHtml += `<div class="grid-stage-col" style="height: ${totalMinutes * pixelsPerMinute}px">${cardsHtml}</div>`;
  });

  container.innerHTML = `
    <div class="grid-container">
      ${headersHtml}
      ${columnsHtml}
    </div>
  `;
}



function renderTimeline(container, acts, dayId) {
  // Sort by start time, taking night/early morning slots (before 05:00) into account
  const compareTime = (tA, tB) => {
    const parse = (tStr) => {
      const [h, m] = tStr.split(':').map(Number);
      return (h < 5 ? h + 24 : h) * 60 + m;
    };
    return parse(tA.start) - parse(tB.start);
  };
  
  const sorted = [...acts].sort(compareTime);
  container.innerHTML = `<div class="band-list">${sorted.map(act =>
    renderBandCard(act, dayId, true)
  ).join('')}</div>`;
}

function renderStages(container, acts, dayId) {
  const stages = ['Utopia', 'Mandora', 'Orbit'];
  
  const compareTime = (tA, tB) => {
    const parse = (tStr) => {
      const [h, m] = tStr.split(':').map(Number);
      return (h < 5 ? h + 24 : h) * 60 + m;
    };
    return parse(tA.start) - parse(tB.start);
  };

  container.innerHTML = stages.map(stage => {
    const stageActs = acts.filter(a => a.stage === stage)
      .sort(compareTime);
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
    return `<div class="band-voter-dot ${mustClass}" style="background:${user.color}" title="${user.name}">${getShortName(user.name)}</div>`;
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
            `<div class="mini-avatar" style="background:${u.color}">${getShortName(u.name)}</div>`
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

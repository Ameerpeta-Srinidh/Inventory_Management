// ── CONFIG ─────────────────────────────────────────────
// Set this to your backend base URL, e.g. 'https://api.yourserver.com'
// Leave as empty string if frontend is served from the same origin as the API.
const API_BASE = '';

// ── API HELPER ─────────────────────────────────────────
async function api(method, path, body) {
  const token = sessionStorage.getItem('token');
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };
  const res = await fetch(API_BASE + path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

const get  = (path)       => api('GET',    path);
const post = (path, body) => api('POST',   path, body);
const del  = (path)       => api('DELETE', path);

// ── APP STATE ──────────────────────────────────────────
const App = {
  user:  null,
  token: null,

  // ── AUTH ──

  // POST /auth/login → { token, user: { id, name, email, role } }
  async login(email, password) {
    const data = await post('/auth/login', { email, password });
    this.token = data.token;
    this.user  = data.user;
    sessionStorage.setItem('token', data.token);
    sessionStorage.setItem('u', JSON.stringify(data.user));
    return true;
  },

  logout() {
    this.user  = null;
    this.token = null;
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('u');
    location.href = 'index.html';
  },

  init() {
    const u = sessionStorage.getItem('u');
    const t = sessionStorage.getItem('token');
    if (u && t) { this.user = JSON.parse(u); this.token = t; return true; }
    return false;
  },

  // ── ROOMS ──

  // GET /rooms → [{ id, code, building, room_type, assigned_to }]
  // Admin: all rooms. Faculty/incharge: only their assigned rooms.
  async myRooms() {
    return get('/rooms');
  },

  // GET /rooms/:code/items → [{ id, asset_code, name, brand, price, status, last_verified_at, category }]
  async roomItems(roomCode) {
    return get(`/rooms/${encodeURIComponent(roomCode)}/items`);
  },

  // POST /rooms → { id, code, building, room_type }
  async addRoom(code, building, room_type) {
    return post('/rooms', { code, building, room_type });
  },

  // ── ITEMS ──

  // POST /items/:id/verify  body: { scan_type, notes? }
  // Returns { ok, scanned_at } or throws (server enforces room-level auth).
  async verify(itemId, notes) {
    try {
      const res = await post(`/items/${itemId}/verify`, { scan_type: 'verify', notes: notes || '' });
      return { ok: true, scanned_at: res.scanned_at };
    } catch (err) {
      return { ok: false, msg: err.message };
    }
  },

  // ── DASHBOARD STATS ──

  // GET /stats → { rooms, total, verified, broken }
  // Scoped to current user's rooms by the server.
  async stats() {
    return get('/stats');
  },

  // ── ADMIN: USERS ──

  // GET  /admin/users        → [{ id, name, email, role }]
  // POST /admin/users        → { id, name, email, role }
  // DEL  /admin/users/:id
  async listUsers()              { return get('/admin/users'); },
  async addUser(name, email, role) { return post('/admin/users', { name, email, role }); },
  async removeUser(id)           { return del(`/admin/users/${id}`); },

  // ── ADMIN: ROOMS ──

  // GET /admin/rooms → [{ id, code, building, room_type, assigned_to }]
  async listRooms() { return get('/admin/rooms'); },

  // ── ADMIN: ASSIGNMENTS ──

  // GET  /admin/assignments          → [{ id, user_id, uname, role, room_id, room_code, room_type }]
  // POST /admin/assignments          → { id }   body: { user_id, room_id }
  // DEL  /admin/assignments/:id
  async listAssignments()              { return get('/admin/assignments'); },
  async addAssignment(user_id, room_id){ return post('/admin/assignments', { user_id, room_id }); },
  async removeAssignment(id)           { return del(`/admin/assignments/${id}`); },

  // ── SCAN LOG ──

  // GET /admin/scan-log → [{ id, asset_code, scanned_by_name, role, room_code, scan_type, scanned_at, notes }]
  async scanLog() { return get('/admin/scan-log'); },
};

// ── HELPERS ────────────────────────────────────────────

App.init();

function rupee(n) {
  return n ? '₹' + Number(n).toLocaleString('en-IN') : '—';
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// DB enum → CSS dot class
function statusClass(s) {
  if (!s) return '';
  const v = s.toLowerCase();
  if (v === 'available' || v === 'in_use')                          return 'available';
  if (v === 'not_working' || v === 'disposed' || v === 'under_repair') return 'broken';
  return 'moved';
}

// DB enum → human label
function statusLabel(s) {
  return { available:'Available', in_use:'In use', under_repair:'Under repair',
           not_working:'Not working', disposed:'Disposed', moved:'Moved' }[s] || s;
}

function progressClass(p) {
  if (p >= 75) return 'fill-high';
  if (p >= 35) return 'fill-mid';
  return 'fill-low';
}

function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) { el = Object.assign(document.createElement('div'), { id:'toast', className:'toast' }); document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2800);
}

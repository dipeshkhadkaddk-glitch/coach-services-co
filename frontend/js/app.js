// =================== SHARED APP UTILITIES ===================

// Toast notifications
const toast = {
  container: null,
  init() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
  },
  show(msg, type = 'info', duration = 4000) {
    this.init();
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span class="toast-icon">${icons[type]||'ℹ️'}</span><span class="toast-msg">${msg}</span><button class="toast-close" onclick="this.parentElement.remove()">×</button>`;
    this.container.appendChild(el);
    setTimeout(() => el.remove(), duration);
  },
  success: (msg) => toast.show(msg, 'success'),
  error: (msg) => toast.show(msg, 'error'),
  info: (msg) => toast.show(msg, 'info'),
  warning: (msg) => toast.show(msg, 'warning'),
};
window.toast = toast;

// Auth guard
function requireAuth(role = null) {
  const token = localStorage.getItem('csc_token');
  const user = JSON.parse(localStorage.getItem('csc_user') || 'null');
  if (!token || !user) {
    window.location.href = '/';
    return false;
  }
  if (role && user.role !== role) {
    window.location.href = user.role === 'admin' ? '/admin/dashboard.html' : '/user/dashboard.html';
    return false;
  }
  return user;
}
window.requireAuth = requireAuth;

// Logout
function logout() {
  localStorage.removeItem('csc_token');
  localStorage.removeItem('csc_user');
  window.location.href = '/';
}
window.logout = logout;

// Format date
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}
window.formatDate = formatDate;

function formatDateTime(dateStr) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
window.formatDateTime = formatDateTime;

function formatTime(timeStr) {
  if (!timeStr) return 'N/A';
  const [h, m] = timeStr.split(':');
  const hr = parseInt(h);
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
}
window.formatTime = formatTime;

// Badge HTML
function statusBadge(status) {
  return `<span class="badge badge-${status}">${status}</span>`;
}
window.statusBadge = statusBadge;

// Populate sidebar user info
function populateSidebar(user) {
  const nameEl = document.getElementById('sidebar-user-name');
  const roleEl = document.getElementById('sidebar-user-role');
  const avatarEl = document.getElementById('sidebar-user-avatar');
  if (nameEl) nameEl.textContent = user.full_name || user.name || 'User';
  if (roleEl) roleEl.textContent = user.role;
  if (avatarEl) avatarEl.textContent = (user.full_name || user.name || 'U')[0].toUpperCase();
}
window.populateSidebar = populateSidebar;

// Mobile sidebar toggle
function initSidebar() {
  const hamburger = document.getElementById('hamburger');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (hamburger && sidebar) {
    hamburger.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay && overlay.classList.toggle('show');
    });
    overlay && overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('show');
    });
  }
}
window.initSidebar = initSidebar;

// Notifications
async function loadNotifications() {
  const res = await api.getNotifications();
  if (!res.ok) return;
  const notifs = res.data.data || [];
  const unread = notifs.filter(n => !n.is_read).length;

  const dot = document.getElementById('notif-dot');
  if (dot) dot.style.display = unread > 0 ? 'block' : 'none';

  const list = document.getElementById('notif-list');
  if (!list) return;
  if (notifs.length === 0) {
    list.innerHTML = '<div class="notif-empty">🔔 No notifications yet</div>';
    return;
  }
  list.innerHTML = notifs.map(n => `
    <div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="markNotifRead(${n.id}, this)">
      <div class="notif-msg">${n.message}</div>
      <div class="notif-time">${formatDateTime(n.created_at)}</div>
    </div>
  `).join('');
}
window.loadNotifications = loadNotifications;

async function markNotifRead(id, el) {
  await api.markRead(id);
  el.classList.remove('unread');
  const dot = document.getElementById('notif-dot');
  const remaining = document.querySelectorAll('.notif-item.unread').length;
  if (dot && remaining === 0) dot.style.display = 'none';
}
window.markNotifRead = markNotifRead;

function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  panel && panel.classList.toggle('open');
}
window.toggleNotifPanel = toggleNotifPanel;

// Modal helpers
function openModal(id) { document.getElementById(id)?.classList.add('show'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('show'); }
window.openModal = openModal;
window.closeModal = closeModal;

// Confirm dialog
function confirmAction(msg) { return window.confirm(msg); }
window.confirmAction = confirmAction;

// Form validation
function validateForm(form) {
  let valid = true;
  form.querySelectorAll('[required]').forEach(field => {
    if (!field.value.trim()) {
      field.classList.add('error');
      valid = false;
    } else {
      field.classList.remove('error');
    }
  });
  return valid;
}
window.validateForm = validateForm;

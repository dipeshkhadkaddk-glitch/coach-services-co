// =================== API UTILITY ===================
const API_BASE = '/api';

const api = {
  getToken: () => localStorage.getItem('csc_token'),
  getUser: () => JSON.parse(localStorage.getItem('csc_user') || 'null'),

  headers: () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${api.getToken()}`
  }),

  async request(method, path, body = null) {
    const opts = { method, headers: api.headers() };
    if (body) opts.body = JSON.stringify(body);
    try {
      const res = await fetch(`${API_BASE}${path}`, opts);
      const data = await res.json();
      return { ok: res.ok, status: res.status, data };
    } catch (err) {
      return { ok: false, status: 0, data: { success: false, message: 'Network error. Please try again.' } };
    }
  },

  get: (path) => api.request('GET', path),
  post: (path, body) => api.request('POST', path, body),
  put: (path, body) => api.request('PUT', path, body),
  delete: (path) => api.request('DELETE', path),

  // Auth
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', data),

  // Users
  getMe: () => api.get('/users/me'),
  updateMe: (data) => api.put('/users/me', data),
  getAllUsers: (search = '') => api.get(`/users${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  getPendingUsers: () => api.get('/users/pending'),
  updateUserStatus: (id, status, reason = '') => api.put(`/users/${id}/status`, { status, reason }),
  deleteUser: (id) => api.delete(`/users/${id}`),

  // Vehicles
  getVehicles: () => api.get('/vehicles'),
  getVehicle: (id) => api.get(`/vehicles/${id}`),
  createVehicle: (data) => api.post('/vehicles', data),
  updateVehicle: (id, data) => api.put(`/vehicles/${id}`, data),
  deleteVehicle: (id) => api.delete(`/vehicles/${id}`),

  // Routes
  searchRoutes: (pickup = '', dropoff = '') => {
    const params = new URLSearchParams();
    if (pickup) params.set('pickup', pickup);
    if (dropoff) params.set('dropoff', dropoff);
    return api.get(`/routes${params.toString() ? '?' + params.toString() : ''}`);
  },
  getAllRoutes: () => api.get('/routes'),
  createRoute: (data) => api.post('/routes', data),
  updateRoute: (id, data) => api.put(`/routes/${id}`, data),
  deleteRoute: (id) => api.delete(`/routes/${id}`),
  toggleRouteClose: (id) => api.put(`/routes/${id}/toggle-close`, {}),
  getPassengerManifest: (routeId) => api.get(`/routes/${routeId}/passengers`),

  // Events
  getEvents: () => api.get('/events'),
  getEvent: (id) => api.get(`/events/${id}`),
  createEvent: (data) => api.post('/events', data),
  updateEvent: (id, data) => api.put(`/events/${id}`, data),
  deleteEvent: (id) => api.delete(`/events/${id}`),

  // Bookings
  getBookings: (type = '') => api.get(`/bookings${type ? `?type=${type}` : ''}`),
  createBooking: (data) => api.post('/bookings', data),
  updateBookingStatus: (id, status) => api.put(`/bookings/${id}/status`, { status }),
  deleteBooking: (id) => api.delete(`/bookings/${id}`),

  // Notifications
  getNotifications: () => api.get('/notifications'),
  markRead: (id) => api.put(`/notifications/${id}/read`, {}),
  markAllRead: () => api.put('/notifications/read-all', {}),

  // Dashboard
  getDashboardStats: () => api.get('/dashboard/stats'),
};

window.api = api;

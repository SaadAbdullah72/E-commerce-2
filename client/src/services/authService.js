import API from './api';

export const authService = {
  // Sign up / Register new user
  async signup(userData) {
    const response = await API.post('/auth/signup', userData);
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  // Log in existing user
  async login(credentials) {
    const response = await API.post('/auth/login', credentials);
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  // Fetch current user profile from server
  async getMe() {
    const response = await API.get('/auth/me');
    if (response.data.user) {
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data.user;
  },

  // Update profile
  async updateProfile(profileData) {
    const response = await API.put('/auth/profile', profileData);
    if (response.data.user) {
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  // Log out
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  // Helper to read stored user without network call
  getStoredUser() {
    try {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  },

  // Helper to check if token exists
  isAuthenticated() {
    return !!localStorage.getItem('token');
  },
};

export default authService;

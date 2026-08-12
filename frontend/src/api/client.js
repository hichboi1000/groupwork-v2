import axios from 'axios';

// Falls back to localhost so the app still works out of the box with no
// .env file — but set VITE_API_BASE_URL in frontend/.env to point at your
// LAN IP when testing from a phone (see .env.example).
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem('refresh_token');
      if (refresh) {
        try {
          const res = await axios.post(`${API_BASE_URL}/token/refresh/`, { refresh });
          localStorage.setItem('access_token', res.data.access);
          original.headers.Authorization = `Bearer ${res.data.access}`;
          return api(original);
        } catch {
          localStorage.clear();
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export const login = (credentials) => axios.post(`${API_BASE_URL}/token/`, credentials);
export const register = (data) => api.post('/register/', data);
export const getMe = () => api.get('/me/');
export const getDashboardStats = () => api.get('/dashboard/');

// Classes (rep-managed cohorts)
export const getClasses = () => api.get('/classes/');
export const createClass = (data) => api.post('/classes/', data);
export const getClass = (id) => api.get(`/classes/${id}/`);
export const updateClass = (id, data) => api.patch(`/classes/${id}/`, data);
export const deleteClass = (id) => api.delete(`/classes/${id}/`);
export const addRepToClass = (id, userId) => api.post(`/classes/${id}/add-rep/`, { user_id: userId });

export const createGroup = (data) => api.post('/groups/create/', data);
export const joinGroup = (data) => api.post('/groups/join/', data);
export const getMyGroup = () => api.get('/groups/mine/');
export const getAllGroups = () => api.get('/groups/all/');
export const leaveGroup = () => api.delete('/groups/leave/');
export const getGroupProgress = (groupId) => api.get('/groups/progress/', { params: groupId ? { group_id: groupId } : {} });
export const getTasks = (params) => api.get('/tasks/', { params });
export const getTask = (id) => api.get(`/tasks/${id}/`);
export const createTask = (data) => api.post('/tasks/', data);
export const updateTask = (id, data) => {
  // If a file is included, send multipart; otherwise plain JSON works fine.
  if (data.submission_file instanceof File) {
    const form = new FormData();
    Object.entries(data).forEach(([k, v]) => { if (v !== undefined && v !== null) form.append(k, v); });
    return api.patch(`/tasks/${id}/`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
  }
  return api.patch(`/tasks/${id}/`, data);
};
export const deleteTask = (id) => api.delete(`/tasks/${id}/`);

// Units — getUnits() is scoped server-side by role automatically
export const getUnits = () => api.get('/units/');
export const createUnit = (data) => api.post('/units/create/', data);
export const getMyUnits = () => api.get('/units/mine/');

// Unit Offerings (attach/detach — rep controlled)
export const getUnitOfferings = () => api.get('/unit-offerings/');
export const getUnitOfferingsHistory = () => api.get('/unit-offerings/history/');
export const attachClassToUnit = (data) => api.post('/unit-offerings/attach/', data);
export const detachClass = (offeringId, confirm = false) =>
  api.post(`/unit-offerings/${offeringId}/detach/`, { confirm });

export const getAssignments = () => api.get('/assignments/');
export const getAssignment = (id) => api.get(`/assignments/${id}/`);
export const createAssignment = (data) => api.post('/assignments/', data);
export const updateAssignment = (id, data) => api.patch(`/assignments/${id}/`, data);
export const deleteAssignment = (id) => api.delete(`/assignments/${id}/`);
export const getGroupAssignments = () => api.get('/group-assignments/');
export const createGroupAssignment = (data) => api.post('/group-assignments/', data);
export const markGroupAssignmentReviewed = (id) => api.patch(`/group-assignments/${id}/review/`);
export const getSubmissions = () => api.get('/submissions/');

// Task evidence and submission files are served through authenticated,
// permission-checked endpoints now (not raw /media/ URLs), so a plain
// <a href> can't download them — no way to attach a Bearer token to a
// browser-initiated navigation. This fetches the file through axios
// (which does attach it via the request interceptor above), then
// triggers a normal save-as using an in-memory object URL.
export const downloadFile = async (url, suggestedName) => {
  const response = await api.get(url, { responseType: 'blob' });
  const disposition = response.headers['content-disposition'];
  const match = disposition && disposition.match(/filename="?([^"]+)"?/);
  const filename = (match && match[1]) || suggestedName || 'download';

  const objectUrl = window.URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(objectUrl);
};
export const createSubmission = (data) => {
  const form = new FormData();
  Object.entries(data).forEach(([k, v]) => { if (v !== undefined) form.append(k, v); });
  return api.post('/submissions/', form, { headers: { 'Content-Type': 'multipart/form-data' } });
};

// Internal group files — collaboration between group members, separate
// from Submission (the final, external handoff to lecturer/rep).
export const getGroupFiles = () => api.get('/groups/files/');
export const uploadGroupFile = (file, description) => {
  const form = new FormData();
  form.append('file', file);
  if (description) form.append('description', description);
  return api.post('/groups/files/', form, { headers: { 'Content-Type': 'multipart/form-data' } });
};
export const deleteGroupFile = (id) => api.delete(`/groups/files/${id}/`);
export const getNotifications = () => api.get('/notifications/');
export const markRead = (id) => api.patch(`/notifications/${id}/read/`);
export const markAllRead = () => api.post('/notifications/read-all/');
export const getUsers = () => api.get('/users/');

export default api;

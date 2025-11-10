import api from './api';

const getReports = () => api.get('/admin/reports');

const updateReportStatus = (reportId, status) =>
  api.patch(`/admin/reports/${reportId}/status`, { status });

const getUsers = () => api.get('/admin/users');

const toggleUserBlock = (userId, block) =>
  api.patch(`/admin/users/${userId}/block`, { block });

const deleteUser = (userId) => api.delete(`/admin/users/${userId}`);

export default {
  getReports,
  updateReportStatus,
  getUsers,
  toggleUserBlock,
  deleteUser,
};

import api from './api';

const getReports = () => {
  return api.get('/reports');
};

const createReport = (data) => {
  return api.post('/reports', data);
};

const vote = (id, vote) => {
  return api.post(`/reports/${id}/vote`, { vote });
};

const getMyReports = async () => {
  // Fallback implementation: fetch all reports from the API and let the caller
  // filter by user id. The previous implementation used `supabase` client in the
  // frontend which isn't available in this bundle and caused a runtime error.
  const response = await api.get('/reports');
  return response;
};

export default {
  getReports,
  createReport,
  vote,
  getMyReports,
};

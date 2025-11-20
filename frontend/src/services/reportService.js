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
  const response = await api.get('/reports');
  return response;
};

export default {
  getReports,
  createReport,
  vote,
  getMyReports,
};

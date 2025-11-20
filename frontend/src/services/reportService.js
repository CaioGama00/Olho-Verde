import api from './api';

const getReports = () => {
  return api.get('/reports');
};

const createReport = ({ problem, description, lat, lng, image }) => {
  const formData = new FormData();
  formData.append('problem', problem);
  formData.append('description', description || '');
  formData.append('lat', lat);
  formData.append('lng', lng);
  if (image) {
    formData.append('image', image);
  }

  return api.post('/reports', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

const vote = (id, vote) => {
  return api.post(`/reports/${id}/vote`, { vote });
};

const getMyReports = async () => {
  const response = await api.get('/reports');
  return response;
};

const getReportDetails = (id) => api.get(`/reports/${id}`);
const getComments = (id) => api.get(`/reports/${id}/comments`);
const addComment = (id, content) => api.post(`/reports/${id}/comments`, { content });

export default {
  getReports,
  createReport,
  vote,
  getMyReports,
  getReportDetails,
  getComments,
  addComment,
};

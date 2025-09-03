import axios from 'axios';

const API_URL = 'http://localhost:3001/api/reports';

const getAuthToken = () => {
  const user = JSON.parse(localStorage.getItem('user'));
  return user ? user.accessToken : null;
};

const getReports = () => {
  return axios.get(API_URL);
};

const createReport = (data) => {
  const token = getAuthToken();
  return axios.post(API_URL, data, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

const vote = (id, vote) => {
  const token = getAuthToken();
  return axios.post(`${API_URL}/${id}/vote`, { vote }, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export default {
  getReports,
  createReport,
  vote,
};

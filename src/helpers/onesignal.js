const axios = require('axios');

const oneSignalApi = axios.create({
  baseURL: 'https://onesignal.com/api/v1'
});

module.exports = oneSignalApi;

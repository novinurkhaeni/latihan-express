const axios = require('axios');

const getAdress = async coord => {
  let address = {};
  for (let c in coord) {
    if (coord[c]) {
      const [lat, long] = coord[c].split(',');
      const {
        data: { results }
      } = await axios.get(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${long}&key=AIzaSyCYeTjYxeO0PnoTMaut51H8ysCRn-4eFDQ`
      );
      address[c] = results[0].formatted_address;
    } else {
      address[c] = '';
    }
  }

  return address;
};

module.exports = getAdress;

const { getUser, userManipulation } = require('./suites');

describe('Users', function() {
  describe('Get User', getUser.bind(this));
  describe('User Manipulation', userManipulation.bind(this));
});

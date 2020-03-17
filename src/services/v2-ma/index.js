const accessTokenService = require('./access-token/access.token.service');
const companyService = require('./company/company.service');
const membersService = require('./members/members.service');
const pinService = require('./pin/pin.service');
const presenceService = require('./presence/presence.service');
const digitalAssetService = require('./digital-assets/digital.assets.service');

module.exports = {
  accessTokenService,
  companyService,
  membersService,
  pinService,
  presenceService,
  digitalAssetService
};

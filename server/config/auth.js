const AuthenticationService = require('../domain/identity/services/AuthenticationService');
const { verifyToken } = require('../core/auth');

function generateToken(payload, expiresIn) {
  return AuthenticationService.generateJWT(payload, expiresIn);
}

module.exports = {
  verifyToken,
  generateToken,
};


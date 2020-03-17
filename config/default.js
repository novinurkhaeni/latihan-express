module.exports = {
  host: 'localhost',
  ngrok: '7bf3edd0.ngrok.io',
  port: 3000,
  public: 'public',
  uploads: 'public/uploads',
  documents: 'public/documents',
  paginate: {
    default: 10,
    max: 50
  },
  authentication: {
    secret: 'sup3rs3cr3t',
    strategies: ['jwt', 'local'],
    path: '/authentication',
    service: 'users',
    jwt: {
      header: {
        typ: 'access'
      },
      audience: 'https://yourdomain.com',
      subject: 'anonymous',
      issuer: 'feathers',
      algorithm: 'HS256',
      expiresIn: '1d'
    },
    local: {
      entity: 'users',
      usernameField: 'email',
      passwordField: 'password'
    },
    facebook: {
      clientID: '154380921909272',
      clientSecret: '2ad5198b2c9badb3f8e7cf16cf7c2cdd',
      successRedirect: '/',
      scope: ['public_profile', 'email'],
      profileFields: [
        'id',
        'displayName',
        'first_name',
        'last_name',
        'email',
        'gender',
        'profileUrl',
        'birthday',
        'picture',
        'permissions'
      ],
      graphUri: 'https://graph.accountkit.com/v1.3/'
    },
    cookie: {
      enabled: true,
      name: 'feathers-jwt',
      httpOnly: false,
      secure: false
    }
  },
  mysql: 'mysql://root:root@127.0.0.1:3306/gajian_dulu'
};

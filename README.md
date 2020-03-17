# gajiandulu-api

### PLEASE COMPLETELY READ THESE INFORMATION FIRST!!

---

## Wiki & Specification Info

### [Backend & Mobile Specification](https://bitbucket.org/gajiandulu/gajiandulu-api/wiki/browse/)

## Main Tech stacks

    * MySql as main database engine
    * NodeJS as server runner
    * Express as server framework
    * Apollo Server as graphql framework (only used for admin dashboard connection, mobile use general REST API)
    * Sequelize as database ORM
    * Json Web Token aka JWT as authentication
    * NodeMailer as mailer
    * Facebook Account Kit as OTP Service

## Getting Started

Getting up and running is as easy as 1, 2, 3.

1.  Make sure you have [NodeJS](https://nodejs.org/) and [npm](https://www.npmjs.com/) installed.
    Required version:
    ```
    "node": ">= 9.0.0"
    ```
2.  Install your dependencies

    ```
    cd path/to/gajiandulu-api; npm install
    ```

3.  Configure things

    > Create .env file in root directory of the project

    Write this in `.env` file

    #### .env

    ```
        SERVER_DOMAIN=gajiandulu-api.projects.refactory.id
        SERVER_PORT=8000
        DEV_HOST=127.0.0.1
        DEV_USER={your_mysql_username}
        DEV_PASS={your_mysql_password}
        DEV_DATABASE=bibitnomic_dev
    ```

    #### src/helpers/mailer.js

    You can test email in sandbox using mailtrap, just create account and get the smtp user pass to configure in these line:

    ```
    auth = {
        host: 'smtp.mailtrap.io',
        port: 2525,
        auth: {
            user: 'fd992b099d817f',
            pass: '6b564816b97868'
        }
    };
    ```

4.  Migrate database using sequelize
    Run these commands in order

    ### If you have sequelize installed global

    ```
    sequelize db:create
    ```

    ```
    sequelize db:migrate
    ```

    ### If you have been not installing sequelize global

    ```
    node_modules/.bin/sequelize db:create
    ```

    ```
    node_modules/.bin/sequelize db:migrate
    ```

5.  OPTIONAL: You can run seeder to have dummy data in the table needed, for detailed information about the data like user password, etc. Look at src/database/seeders in the name dummy-data.js file. Just then run the command.

    ### If you have sequelize installed global

    ```
    sequelize db:seed:all
    ```

    ### If you have been not installing sequelize global

    ```
    node_modules/.bin/sequelize db:seed:all
    ```

    ### Alternative way, you can use bash seed.sh

6.  Start your app

    ```
    npm start
    ```

## Testing

Simply run `npm run test` and all your tests in the `test/` directory will be run.

## Changelog

**1.0.0 - 1 August 2018**

- Production Initial Release

## License

Copyright (c) 2018

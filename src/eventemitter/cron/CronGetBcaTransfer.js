require('module-alias/register');
const axios = require('axios');
const sha256 = require('js-sha256');
const querystring = require('querystring');
const {
  Sequelize,
  transactions: Transaction,
  employees: Employee,
  journals: Journal,
  companies: Company,
  notifications: Notif,
  subscribements: Subscribement
} = require('@models');
const { oneSignalApi } = require('@helpers');
const EVENT = require('../constants');

class CronGetBcaTransfer {
  constructor(observable) {
    this.observable = observable;
  }

  getDateDetail(day) {
    const year = day.getFullYear();
    const month =
      (day.getMonth() + 1).toString().length === 2
        ? `${day.getMonth() + 1}`
        : `0${day.getMonth() + 1}`;
    const date = day.getDate().toString().length === 2 ? `${day.getDate()}` : `0${day.getDate()}`;

    return `${year}-${month}-${date}`;
  }

  async getAccessToken() {
    let clientId, clientSecret, host;
    if (process.env.NODE_ENV !== 'production') {
      clientId = 'b095ac9d-2d21-42a3-a70c-4781f4570704';
      clientSecret = 'bedd1f8d-3bd6-4d4a-8cb4-e61db41691c9';
      host = 'https://devapi.klikbca.com:443';
    } else {
      clientId = process.env.BCA_CLIENT_ID;
      clientSecret = process.env.BCA_CLIENT_SECRET;
      host = 'https://api.klikbca.com:443';
    }
    const data = `${clientId}:${clientSecret}`;
    const buff = new Buffer(data);
    const base64data = buff.toString('base64');
    const requestBody = {
      grant_type: 'client_credentials'
    };
    const getToken = await axios.post(
      `${host}/api/oauth/token`,
      querystring.stringify(requestBody),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${base64data}`
        }
      }
    );
    return getToken.data;
  }

  async getTransfer(transferParam) {
    const { relativeUrl, token, timeStamp, signature } = transferParam;
    let apiKey, host;
    if (process.env.NODE_ENV !== 'production') {
      apiKey = 'dcc99ba6-3b2f-479b-9f85-86a09ccaaacf';
      host = 'https://devapi.klikbca.com:443';
    } else {
      apiKey = process.env.BCA_API_KEY;
      host = 'https://api.klikbca.com:443';
    }

    const transfer = await axios.get(`${host}${relativeUrl}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `${token.token_type} ${token.access_token}`,
        Origin: 'https://api.atenda.id',
        'X-BCA-Key': apiKey,
        'X-BCA-Timestamp': timeStamp,
        'X-BCA-Signature': signature
      }
    });

    return transfer.data;
  }

  async processTransactionData(transactionParam) {
    const { date, transferAmount } = transactionParam;
    const amount = transferAmount.split('.')[0];
    const transaction = await Transaction.findOne({
      where: [
        Sequelize.where(
          Sequelize.fn('DATE_FORMAT', Sequelize.col('transactions.created_at'), '%Y-%m-%d'),
          '=',
          date
        ),
        {
          total_amount: amount,
          payment_method: 'mt',
          payment_status: '02'
        }
      ],
      include: [
        {
          model: Employee,
          attributes: ['id'],
          include: [
            {
              model: Company,
              attributes: ['id']
            }
          ]
        }
      ]
    });

    if (transaction) {
      await Transaction.update(
        {
          paid_amount: amount,
          payment_status: '00'
        },
        { where: { id: transaction.id } }
      );

      if (transaction.type == 1) {
        await Journal.create({
          employee_id: transaction.employee_id,
          company_id: transaction.employee.company.id,
          type: 'payment',
          debet: 0,
          kredit: 0,
          description: transaction.id_description,
          balance: 1,
          created_at: transaction.created_at,
          updated_at: transaction.updated_at
        });
      }

      if (transaction.type == 2) {
        // Find Related Company Ids with Transaction
        let companyIds = [];
        const subscribements = await Subscribement.findAll({
          attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('company_id')), 'company_id']],
          where: { transaction_id: transaction.id }
        });
        companyIds = subscribements.map(val => val.company_id);
        for (const companyId of companyIds) {
          await Company.update({ active: 1 }, { where: { id: companyId } });
        }
      }

      let filters = [];

      await Notif.create({
        employee_id: transaction.employee_id,
        body: `${transaction.id_description} pada ${date} telah lunas`
      });

      filters.push({
        field: 'tag',
        key: 'employeeId',
        relation: '=',
        value: transaction.employee_id
      });
      if (process.env.NODE_ENV !== 'production') {
        // prettier-ignore
        /* eslint-disable quotes */
        filters.push(
          {"operator": "AND"},
          {"field": "tag", "key": "env", "relation": "=", "value": "development"}
        );
      }
      const payload = {
        filters,
        data: {
          transaction_id: transaction.id,
          type: transaction.type,
          payment_method: transaction.payment_method,
          payment_status: transaction.payment_status
        },
        headings: { en: 'Transfer BCA' },
        contents: { en: `${transaction.id_description} pada ${date} telah lunas` }
      };

      const payloadAndroid = { ...payload, app_id: process.env.ANDROID_ONESIGNAL_APPID };
      const payloadIOS = { ...payload, app_id: process.env.IOS_ONESIGNAL_APPID };

      oneSignalApi.post('/notifications', payloadAndroid, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${process.env.ANDROID_ONESIGNAL_APIKEY}`
        }
      });

      oneSignalApi.post('/notifications', payloadIOS, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${process.env.IOS_ONESIGNAL_APIKEY}`
        }
      });
    }
  }

  async listenCronGetBcaTransfer() {
    this.observable.addListener(EVENT.CRON_GET_BCA_TRANSFER, async () => {
      global.bcaAccountStatementLog.write(`BCA RUNNING \n`);
      let today = new Date();
      let startDate, endDate;
      startDate = endDate = this.getDateDetail(today);
      const token = await this.getAccessToken();

      let corporateId, accountNumber, apiSecret;
      if (process.env.NODE_ENV !== 'production') {
        corporateId = 'h2hauto008';
        accountNumber = '0613005827';
        apiSecret = '5e636b16-df7f-4a53-afbe-497e6fe07edc';
      } else {
        corporateId = process.env.BCA_CORPORATE_ID;
        accountNumber = process.env.BCA_ACCOUNT_NUMBER;
        apiSecret = process.env.BCA_API_SECRET;
      }

      const httpMethod = 'GET';
      const relativeUrl = `/banking/v3/corporates/${corporateId}/accounts/${accountNumber}/statements?EndDate=${endDate}&StartDate=${startDate}`;
      const timeStamp = today.toISOString();
      var requestBody = sha256.create();
      requestBody.update('');
      requestBody.hex();

      const StringToSign =
        httpMethod +
        ':' +
        relativeUrl +
        ':' +
        token.access_token +
        ':' +
        requestBody +
        ':' +
        timeStamp;

      const signature = sha256.hmac(apiSecret, StringToSign);

      const transferParam = {
        timeStamp,
        signature,
        token,
        relativeUrl
      };

      const transfers = await this.getTransfer(transferParam);

      const log = `${new Date().toISOString()} [Content]: ${JSON.stringify(transfers)} \n\n`;
      global.bcaAccountStatementLog.write(log);

      for (const transfer of transfers.Data) {
        if (transfer.TransactionType === 'C') {
          const transactionParam = {
            date: startDate,
            transferAmount: transfer.TransactionAmount
          };

          await this.processTransactionData(transactionParam);
        }
      }
    });
  }
}

module.exports = CronGetBcaTransfer;

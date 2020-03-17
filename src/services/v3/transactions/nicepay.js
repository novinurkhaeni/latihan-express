require('module-alias/register');
const { Sequelize } = require('sequelize');
const axios = require('axios');
const { response } = require('@helpers');
const querystring = require('querystring');
const sha256 = require('js-sha256');
const {
  sequelize,
  employees: Employee,
  companies: Company,
  users: User,
  journals: Journal,
  transactions: Transaction,
  subscribements: Subscribement
} = require('@models');
const config = require('config');
const EVENT = require('../../../eventemitter/constants');
const { observe } = require('../../../eventemitter');

/* eslint-disable quotes*/
const nicepayService = {
  getNicepayCcStatus: async (req, res) => {
    const { users } = res.local;
    const { query: data } = req;
    try {
      const transaction = await Transaction.findOne({
        where: {
          parent_company_id: users.companyParentId,
          payment_status: '02',
          type: data.type
        }
      });

      let payload;

      if (transaction) {
        payload = {
          id: transaction.id,
          payment_status: transaction.payment_status,
          type: transaction.type,
          payment_method: transaction.payment_method,
          url: transaction.url,
          va_number: `11257${transaction.id}`,
          total_amount: transaction.total_amount,
          created_at: transaction.created_at
        };
      } else {
        payload = null;
      }

      return res
        .status(200)
        .json(response(true, 'status transaction berhasil di dapatkan', payload));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  ccNonReccuring: async (req, res) => {
    const { users } = res.local;
    const { body: data } = req;
    // change config.ngrok to your ngrok url if want to test request
    const host =
      process.env.NODE_ENV !== 'production' ? `https://${config.ngrok}` : `https://${config.host}`;
    const iMid = process.env.NODE_ENV !== 'production' ? 'IONPAYTEST' : process.env.NICEPAY_MID;
    const mkey = process.env.NODE_ENV !== 'production' ? '' : process.env.NICEPAY_MKEY;
    const transaction = await sequelize.transaction();
    try {
      const employee = await Employee.findOne({
        where: {
          id: users.employeeId
        },
        include: [
          {
            model: User,
            attributes: ['id', 'full_name', 'email', 'phone']
          },
          {
            model: Company,
            attributes: ['id', 'parent_company_id', 'codename', 'company_name', 'name']
          }
        ]
      });

      if (!employee) {
        return res.status(400).json(response(false, 'employee tidak di temukan'));
      }
      const { user } = employee;
      let transactionData, referenceNo;
      const transactionPayload = {
        employee_id: employee.id,
        parent_company_id: users.companyParentId,
        total_amount: data.amount,
        id_description: data.id_description,
        en_description: data.en_description,
        type: data.type,
        payment_status: '02',
        payment_method: 'cc'
      };

      // find pending transaction
      const pendingTransaction = await Transaction.findOne({
        where: {
          parent_company_id: users.companyParentId,
          type: data.type,
          payment_status: '02'
        }
      });

      // if pending transaction exist do update else do create
      if (pendingTransaction) {
        let today = new Date();
        referenceNo = pendingTransaction.id;
        transactionData = await Transaction.update(
          { ...transactionPayload, created_at: today },
          { where: { id: pendingTransaction.id } },
          { transaction }
        );
      } else {
        if (process.env.NODE_ENV !== 'production') {
          transactionPayload['id'] = 99999;
        }
        transactionData = await Transaction.create(transactionPayload, { transaction });
        referenceNo = transactionData.id;
      }

      if (!transactionData) {
        return res.status(400).json(response(false, 'transaction gagal di lakukan'));
      }
      const amount = data.amount;
      const merchantToken = await getMerchantToken(iMid, mkey, referenceNo, amount);

      const requestBody = {
        iMid,
        payMethod: '01',
        currency: data.currency,
        amt: amount,
        instmntType: '1',
        instmntMon: '1',
        referenceNo,
        goodsNm: data.goods_name,
        billingNm: user.full_name,
        billingPhone: user.phone,
        billingEmail: user.email,
        billingCity: "''",
        billingState: "''",
        billingPostCd: "''",
        billingCountry: "''",
        callBackUrl: `${host}/api/v3/callback/nicepay/cc/non-reccuring?merchantToken=${merchantToken}`,
        dbProcessUrl: `${host}/api/v3/callback/nicepay/cc/non-reccuring/notif`,
        description: data.id_description,
        merchantToken,
        userIP: '127.0.0.1',
        cartData: '{}'
      };

      /* This for specified cart data
      const cartData = {
        count: '1',
        item: [
          {
            img_url: 'https://www.lecs.com/image/introduction/img_vmd020101.jpg',
            goods_name: 'Jam Tangan Army - Strap Kulit - Hitam',
            goods_detail: 'jumlah 1',
            goods_amt: '400'
          }
        ]
      };

      requestBody['cartData'] = JSON.stringify(cartData);*/

      const result = await axios.post(
        'https://www.nicepay.co.id/nicepay/api/orderRegist.do',
        querystring.stringify(requestBody),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const transform = result.data.substr(result.data.indexOf('{'));
      const tparse = JSON.parse(transform);

      if (!tparse.tXid || !tparse.data.requestURL) {
        await transaction.rollback();
        return res.status(400).json(response(false, 'transaction gagal di lakukan', tparse));
      }
      const url = `${tparse.data.requestURL}?tXid=${tparse.tXid}&optDisplayCB=1`;

      const payload = {
        tXid: tparse.tXid,
        request_date: tparse.requestDate,
        response_date: tparse.responseDate,
        result_code: tparse.data.resultCd,
        result_message: tparse.data.resultMsg,
        url
      };

      await Transaction.update({ url }, { where: { id: referenceNo }, transaction });

      await transaction.commit();
      return res
        .status(200)
        .json(response(true, 'request nicepay page berhasil di dapatkan', payload));
    } catch (error) {
      await transaction.rollback();
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  ccNonReccuringCallback: async (req, res) => {
    const { query: data } = req;
    String.prototype.splice = function(idx, rem, str) {
      return this.slice(0, idx) + str + this.slice(idx + Math.abs(rem));
    };
    const iMid = process.env.NODE_ENV !== 'production' ? 'IONPAYTEST' : process.env.NICEPAY_MID;
    const mkey = process.env.NODE_ENV !== 'production' ? '' : process.env.NICEPAY_MKEY;

    try {
      let description = '',
        transferDate = data.transDt.splice(4, 0, '-').splice(7, 0, '-'),
        status;

      const findTransaction = await Transaction.findOne({ where: { id: data.referenceNo } });

      if (!findTransaction) {
        return res.status(400).json(response(false, 'Transaction tidak di temukan'));
      }

      const merchantToken = await getMerchantToken(
        iMid,
        mkey,
        findTransaction.id,
        findTransaction.total_amount
      );

      if (merchantToken !== data.merchantToken) {
        return res.status(400).json(response(false, 'gagal authorize merchant token'));
      }

      // check if resultCd not SUCCESS
      if (data.resultCd !== '0000') {
        await Transaction.update({
          payment_status: '01',
          where: {
            id: data.referenceNo
          }
        });
        description = `${data.description} pada ${transferDate} telah gagal`;
        status = '01';
      } else {
        description = `${data.description} pada ${transferDate} telah lunas`;
        status = '00';
      }
      observe.emit(EVENT.PAYMENT, {
        employeeId: findTransaction.employee_id,
        title: 'Pembayaran Credit Card Nicepay',
        transaction_id: findTransaction.id,
        description,
        type: findTransaction.type,
        payment_method: 'cc',
        status
      });
      return res.end('Sukses melakukan transaksi');
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  ccNonReccuringDbProcess: async (req, res) => {
    /* 
       saya tidak menggunakan sequelize transaction karena bila ccNonReccuringDbProcess endpoint
       di hit oleh nicepay berarti transaksi sudah pasti berhasil jadi walaupun ada 
       kesalahan saat create journal, kita harus tetap mengupdate payment_status menjadi 00(success)
    */
    const { body: data } = req;
    const iMid = process.env.NODE_ENV !== 'production' ? 'IONPAYTEST' : process.env.NICEPAY_MID;
    const mkey = process.env.NODE_ENV !== 'production' ? '' : process.env.NICEPAY_MKEY;
    try {
      const findTransaction = await Transaction.findOne({
        where: { id: data.referenceNo },
        include: {
          model: Employee,
          attributes: ['id'],
          include: [
            {
              model: Company,
              attributes: ['id']
            }
          ]
        }
      });

      if (!findTransaction) {
        return res.status(400).json(response(false, 'Transaction tidak di temukan'));
      }

      const merchantToken = await getMerchantToken(
        iMid,
        mkey,
        findTransaction.id,
        findTransaction.total_amount
      );

      const requestBody = {
        iMid,
        merchantToken,
        tXid: data.tXid,
        amt: data.amt,
        referenceNo: data.referenceNo
      };

      // Check Transaction Status
      const transacionStatus = await axios.post(
        'https://www.nicepay.co.id//nicepay/api/onePassStatus.do',
        querystring.stringify(requestBody),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      // check if Transaction Status not SUCCESS
      if (transacionStatus.data.status !== '0') {
        return res.status(400).json(response(false, 'Transaksi belum berhasil'));
      }

      await findTransaction.update({
        payment_status: '00',
        paid_amount: data.amt
      });

      if (findTransaction.type == 1) {
        await Journal.create({
          employee_id: findTransaction.employee_id,
          company_id: findTransaction.employee.company.id,
          type: 'payment',
          debet: 0,
          kredit: 0,
          description: findTransaction.id_description,
          balance: 1,
          created_at: findTransaction.created_at,
          updated_at: findTransaction.updated_at
        });
      }

      if (findTransaction.type == 2) {
        // Find Related Company Ids with Transaction
        let companyIds = [];
        const subscribements = await Subscribement.findAll({
          attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('company_id')), 'company_id']],
          where: { transaction_id: findTransaction.id }
        });
        companyIds = subscribements.map(val => val.company_id);
        for (const companyId of companyIds) {
          await Company.update({ active: 1 }, { where: { id: companyId } });
        }
      }

      return res
        .status(200)
        .json(response(true, 'response notifikasi nicepay page berhasil di dapatkan'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = nicepayService;

const getMerchantToken = async (iMid, mkey, referenceNo, amount) => {
  if (process.env.NODE_ENV === 'production') {
    return sha256(iMid + referenceNo + amount + mkey);
  } else {
    return '32a387a936073a318017e4b409e11a1178222848d78b6b3d093456b947e6d3a1';
  }
};

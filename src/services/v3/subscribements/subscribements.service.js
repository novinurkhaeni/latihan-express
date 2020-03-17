/* eslint-disable quotes */
require('module-alias/register');
const config = require('config');
const querystring = require('querystring');
const axios = require('axios');
const {
  Sequelize: { Op }
} = require('sequelize');
const {
  sequelize,
  transactions: Transaction,
  subscribements: Subscribement,
  users: User,
  companies: Company,
  packages: Package,
  promos: Promo,
  promo_privates: PromoPrivate
} = require('@models');
const { response, generateNicepayMercToken, dateConverter, diffMonths } = require('@helpers');

const subscribements = {
  create: async (req, res) => {
    const { employeeId, companyParentId, id } = res.local.users;
    const { data } = req.body;
    const transaction = await sequelize.transaction();
    let dateNow = new Date();
    let totalAmount = data.total_amount;
    try {
      const user = await User.findOne({
        where: { id },
        attributes: ['full_name', 'phone', 'email']
      });
      if (!user) {
        return res.status(400).json(response(false, 'User tidak ditemukan'));
      }
      // Find Branches
      let companyIds = await Company.findAll({
        where: { parent_company_id: companyParentId },
        attributes: ['id']
      });
      companyIds = companyIds.map(val => val.id);
      // Get Active Subscribements
      const activeSubscribement = await Subscribement.findAll({
        where: {
          company_id: companyIds,
          date_to_deactive: { [Op.gte]: dateConverter(dateNow) },
          date_to_active: { [Op.lte]: dateConverter(dateNow) }
        }
      });
      // Check Pending Transaction
      let transactions = await Transaction.findOne({
        where: { parent_company_id: companyParentId, type: data.type, payment_status: '02' }
      });
      if (data.payment_method === 'mt') {
        const randomNumber = ('000' + Math.floor(Math.random() * Math.pow(10, 3))).substr(-3);
        totalAmount = data.total_amount.toString().slice(0, -3) + randomNumber;
      }
      // Create Transactions
      const transactionPayload = {
        employee_id: employeeId,
        parent_company_id: companyParentId,
        total_amount: totalAmount,
        id_description: data.id_description,
        en_description: data.en_description,
        type: data.type,
        payment_method: data.payment_method,
        payment_status: '02'
      };
      if (transactions) {
        const transactionId = transactions.id;
        transactions = await Transaction.update(
          transactionPayload,
          {
            where: { id: transactions.id }
          },
          { transaction }
        );
        transactions = await Transaction.findOne({ where: { id: transactionId } });
      } else {
        if (process.env.NODE_ENV !== 'production' && data.payment_method === 'cc') {
          transactionPayload['id'] = 99999;
        }
        transactions = await Transaction.create(transactionPayload, { transaction });
      }
      if (!transactions) {
        await transaction.rollback();
        return res.status(400).json(response(false, 'Gagal mengajukan langganan'));
      }
      const subscribementPayload = [];
      const isHasSubscribement = activeSubscribement.length !== 0;
      let dateToDeactive;
      for (const companyId of data.company_ids) {
        for (const package of data.packages) {
          const isCompanyHasPackage = activeSubscribement.find(
            val =>
              parseInt(val.company_id) === parseInt(companyId) &&
              parseInt(val.package_id) === parseInt(package.id)
          );
          const isHasPackage = activeSubscribement.find(val => val.package_id === package.id);
          let deactive = dateConverter(dateNow.setMonth(dateNow.getMonth() + package.duration));
          if (isHasSubscribement) {
            if (new Date(deactive) > new Date(activeSubscribement[0].date_to_deactive)) {
              deactive = activeSubscribement[0].date_to_deactive;
            }
          }
          if (isCompanyHasPackage === undefined) {
            dateNow = new Date();
            subscribementPayload.push({
              company_id: companyId,
              package_id: package.id,
              transaction_id: transactions.id,
              date_to_active: dateConverter(new Date()),
              date_to_deactive: isHasPackage ? dateToDeactive : deactive
            });
          } else {
            dateToDeactive = isCompanyHasPackage.date_to_deactive;
          }
        }
      }
      // Create Subscribement
      const createSubscribement = await Subscribement.bulkCreate(subscribementPayload, {
        transaction
      });
      if (!createSubscribement) {
        await transaction.rollback();
        return res.status(400).json(response(false, 'Gagal mengajukan langganan'));
      }

      // Set Company Deactive
      const deactiveCompanyIds = [];
      for (const companyId of companyIds) {
        const findId = data.company_ids.find(val => parseFloat(val) === parseFloat(companyId));
        if (findId === undefined) deactiveCompanyIds.push(companyId);
      }
      if (deactiveCompanyIds.length) {
        const updateCompany = await Company.update(
          { active: 0 },
          { where: { id: deactiveCompanyIds } },
          { transaction }
        );
        if (!updateCompany) {
          await transaction.rollback();
          return res.status(400).json(response(false, 'Gagal mengajukan perpanjangan langganan'));
        }
      }

      // Update Promo
      const promo = await updatePromo(data, transaction);
      if (promo.errorMessage) {
        await transaction.rollback();
        return res.status(400).json(response(false, promo.errorMessage));
      }

      if (data.payment_method === 'va') {
        await transaction.commit();
        return res.status(201).json(
          response(true, 'Pengajuan langganan berhasil dilakukan', {
            va_number: `11257${transactions.id}`
          })
        );
      } else if (data.payment_method === 'cc') {
        const nicepay = await handleNicepay(data, transactions, user, transaction);
        if (nicepay.errorMessage) {
          return res.status(400).json(response(false, 'Gagal mengajukan langganan'));
        }
        await transaction.commit();
        return res
          .status(201)
          .json(response(true, 'Pengajuan langganan berhasil dilakukan', nicepay.payload));
      } else if (data.payment_method === 'mt') {
        await transaction.commit();
        transactions = await Transaction.findOne({ where: { id: transactions.id } });
        return res.status(201).json(
          response(true, 'Pengajuan langganan berhasil dilakukan', {
            total_amount: transactions.total_amount,
            created_at: transactions.created_at
          })
        );
      }
    } catch (error) {
      await transaction.rollback();
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  renew: async (req, res) => {
    const { employeeId, companyParentId, id } = res.local.users;
    const { data } = req.body;
    let totalAmount = data.total_amount;
    const transaction = await sequelize.transaction();
    try {
      const user = await User.findOne({
        where: { id },
        attributes: ['full_name', 'phone', 'email']
      });
      if (!user) {
        return res.status(400).json(response(false, 'User tidak ditemukan'));
      }
      // Find Branches
      let companyIds = await Company.findAll({
        where: { parent_company_id: companyParentId },
        attributes: ['id']
      });
      companyIds = companyIds.map(val => val.id);

      const latestBasicSubscribement = await Subscribement.findOne({
        where: { company_id: companyIds },
        order: [['date_to_deactive', 'DESC']],
        include: [
          { model: Transaction, where: { payment_status: '00' }, attributes: [] },
          { model: Package, where: { type: 1 }, attributes: [] }
        ]
      });
      // Check Pending Transaction
      let transactions = await Transaction.findOne({
        where: { parent_company_id: companyParentId, type: data.type, payment_status: '02' }
      });
      if (data.payment_method === 'mt') {
        const randomNumber = ('000' + Math.floor(Math.random() * Math.pow(10, 3))).substr(-3);
        totalAmount = data.total_amount.toString().slice(0, -3) + randomNumber;
      }
      // Create Transactions
      const transactionPayload = {
        employee_id: employeeId,
        parent_company_id: companyParentId,
        total_amount: totalAmount,
        id_description: data.id_description,
        en_description: data.en_description,
        type: data.type,
        payment_method: data.payment_method,
        payment_status: '02'
      };
      if (transactions) {
        const transactionId = transactions.id;
        transactions = await Transaction.update(
          transactionPayload,
          {
            where: { id: transactions.id }
          },
          { transaction }
        );
        transactions = await Transaction.findOne({ where: { id: transactionId } });
      } else {
        if (process.env.NODE_ENV !== 'production' && data.payment_method === 'cc') {
          transactionPayload['id'] = 99999;
        }
        transactions = await Transaction.create(transactionPayload, { transaction });
      }
      if (!transactions) {
        await transaction.rollback();
        return res.status(400).json(response(false, 'Gagal mengajukan perpanjangan langganan'));
      }
      // Create Subscribement
      const subscribementPayload = [];
      for (const companyId of data.company_ids) {
        for (const package of data.packages) {
          let dateToActive = new Date(latestBasicSubscribement.date_to_deactive);
          dateToActive = dateConverter(new Date(dateToActive.setDate(dateToActive.getDate() + 1)));
          let dateToDeactive = new Date(dateToActive);
          dateToDeactive = dateConverter(
            new Date(dateToDeactive.setMonth(dateToDeactive.getMonth() + package.duration))
          );
          subscribementPayload.push({
            company_id: companyId,
            package_id: package.id,
            transaction_id: transactions.id,
            date_to_active: dateToActive,
            date_to_deactive: dateToDeactive
          });
        }
      }

      const createSubscribement = await Subscribement.bulkCreate(subscribementPayload, {
        transaction
      });

      if (!createSubscribement) {
        await transaction.rollback();
        return res.status(400).json(response(false, 'Gagal mengajukan perpanjangan langganan'));
      }

      // Update Promo
      const promo = await updatePromo(data, transaction);
      if (promo.errorMessage) {
        await transaction.rollback();
        return res.status(400).json(response(false, promo.errorMessage));
      }

      if (data.payment_method === 'va') {
        await transaction.commit();
        return res.status(201).json(
          response(true, 'Pengajuan perpanjangan langganan berhasil dilakukan', {
            va_number: `11257${transactions.id}`
          })
        );
      } else if (data.payment_method === 'cc') {
        const nicepay = await handleNicepay(data, transactions, user, transaction);
        if (nicepay.errorMessage) {
          return res.status(400).json(response(false, 'Gagal mengajukan perpanjangan langganan'));
        }
        await transaction.commit();
        return res
          .status(201)
          .json(
            response(true, 'Pengajuan perpanjangan langganan berhasil dilakukan', nicepay.payload)
          );
      } else if (data.payment_method === 'mt') {
        await transaction.commit();
        transactions = await Transaction.findOne({ where: { id: transactions.id } });
        return res.status(201).json(
          response(true, 'Pengajuan perpanjangan langganan berhasil dilakukan', {
            total_amount: transactions.total_amount,
            created_at: transactions.created_at
          })
        );
      }
    } catch (error) {
      await transaction.rollback();
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  newLocation: async (req, res) => {
    const { employeeId, companyParentId, id } = res.local.users;
    const { data } = req.body;
    const transaction = await sequelize.transaction();
    let dateNow = new Date();
    let totalAmount = data.total_amount;
    try {
      const user = await User.findOne({
        where: { id },
        attributes: ['full_name', 'phone', 'email']
      });
      if (!user) {
        return res.status(400).json(response(false, 'User tidak ditemukan'));
      }
      // Find Branches
      let companyIds = await Company.findAll({
        where: { parent_company_id: companyParentId },
        attributes: ['id']
      });
      companyIds = companyIds.map(val => val.id);
      // Get Active Subscribements
      const activeSubscribement = await Subscribement.findAll({
        where: {
          company_id: companyIds,
          date_to_deactive: { [Op.gte]: dateConverter(dateNow) },
          date_to_active: { [Op.lte]: dateConverter(dateNow) }
        }
      });
      const eligibleCompanyIds = [...new Set(activeSubscribement.map(item => item.company_id))];
      data.company_ids.map(val => eligibleCompanyIds.push(val));
      // Check Pending Transaction
      let transactions = await Transaction.findOne({
        where: { parent_company_id: companyParentId, type: data.type, payment_status: '02' }
      });
      if (data.payment_method === 'mt') {
        const randomNumber = ('000' + Math.floor(Math.random() * Math.pow(10, 3))).substr(-3);
        totalAmount = data.total_amount.toString().slice(0, -3) + randomNumber;
      }
      // Create Transactions
      const transactionPayload = {
        employee_id: employeeId,
        parent_company_id: companyParentId,
        total_amount: totalAmount,
        id_description: data.id_description,
        en_description: data.en_description,
        type: data.type,
        payment_method: data.payment_method,
        payment_status: '02'
      };
      if (transactions) {
        const transactionId = transactions.id;
        transactions = await Transaction.update(
          transactionPayload,
          {
            where: { id: transactions.id }
          },
          { transaction }
        );
        transactions = await Transaction.findOne({ where: { id: transactionId } });
      } else {
        if (process.env.NODE_ENV !== 'production' && data.payment_method === 'cc') {
          transactionPayload['id'] = 99999;
        }
        transactions = await Transaction.create(transactionPayload, { transaction });
      }
      if (!transactions) {
        await transaction.rollback();
        return res.status(400).json(response(false, 'Gagal mengajukan langganan'));
      }
      const subscribementPayload = [];
      const isHasSubscribement = activeSubscribement.length !== 0;
      for (const companyId of eligibleCompanyIds) {
        for (const package of data.packages) {
          const isCompanyHasPackage = activeSubscribement.find(
            val =>
              parseInt(val.company_id) === parseInt(companyId) &&
              parseInt(val.package_id) === parseInt(package.id)
          );
          const isHasPackage = activeSubscribement.find(val => val.package_id === package.id);
          let deactive = dateConverter(dateNow.setMonth(dateNow.getMonth() + package.duration));
          if (isHasSubscribement) {
            if (new Date(deactive) > new Date(activeSubscribement[0].date_to_deactive)) {
              deactive = activeSubscribement[0].date_to_deactive;
            }
          }
          if (isCompanyHasPackage === undefined) {
            dateNow = new Date();
            subscribementPayload.push({
              company_id: companyId,
              package_id: package.id,
              transaction_id: transactions.id,
              date_to_active: dateConverter(new Date()),
              date_to_deactive: isHasPackage ? isHasPackage.date_to_deactive : deactive
            });
          }
        }
      }
      // Create Subscribement
      const createSubscribement = await Subscribement.bulkCreate(subscribementPayload, {
        transaction
      });
      if (!createSubscribement) {
        await transaction.rollback();
        return res.status(400).json(response(false, 'Gagal mengajukan langganan'));
      }

      // Set Company Deactive
      const deactiveCompanyIds = [];
      for (const companyId of companyIds) {
        const findId = eligibleCompanyIds.find(val => parseFloat(val) === parseFloat(companyId));
        if (findId === undefined) deactiveCompanyIds.push(companyId);
      }
      if (deactiveCompanyIds.length) {
        const updateCompany = await Company.update(
          { active: 0 },
          { where: { id: deactiveCompanyIds } },
          { transaction }
        );
        if (!updateCompany) {
          await transaction.rollback();
          return res.status(400).json(response(false, 'Gagal mengajukan perpanjangan langganan'));
        }
      }

      // Update Promo
      const promo = await updatePromo(data, transaction);
      if (promo.errorMessage) {
        await transaction.rollback();
        return res.status(400).json(response(false, promo.errorMessage));
      }

      if (data.payment_method === 'va') {
        await transaction.commit();
        return res.status(201).json(
          response(true, 'Pengajuan langganan berhasil dilakukan', {
            va_number: `11257${transactions.id}`
          })
        );
      } else if (data.payment_method === 'cc') {
        const nicepay = await handleNicepay(data, transactions, user, transaction);
        if (nicepay.errorMessage) {
          return res.status(400).json(response(false, 'Gagal mengajukan langganan'));
        }
        await transaction.commit();
        return res
          .status(201)
          .json(response(true, 'Pengajuan langganan berhasil dilakukan', nicepay.payload));
      } else if (data.payment_method === 'mt') {
        await transaction.commit();
        transactions = await Transaction.findOne({ where: { id: transactions.id } });
        return res.status(201).json(
          response(true, 'Pengajuan langganan berhasil dilakukan', {
            total_amount: transactions.total_amount,
            created_at: transactions.created_at
          })
        );
      }
    } catch (error) {
      await transaction.rollback();
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  get: async (req, res) => {
    const { companyParentId } = res.local.users;
    const dateNow = dateConverter(new Date());
    try {
      // Find Branches
      let companyIds = await Company.findAll({
        where: { parent_company_id: companyParentId },
        attributes: ['id']
      });
      companyIds = companyIds.map(val => val.id);
      // Get Active Subscribements
      const currentBasicPackage = await Subscribement.findAll({
        where: {
          company_id: companyIds,
          date_to_deactive: { [Op.gte]: dateNow },
          date_to_active: { [Op.lte]: dateNow }
        },
        include: [
          { model: Package, where: { type: 1 }, attributes: [] },
          { model: Transaction, where: { payment_status: '00' }, attributes: [] }
        ]
      });
      const incomingBasicPackage = await Subscribement.findAll({
        attributes: ['date_to_active', 'date_to_deactive', 'transaction_id'],
        where: {
          company_id: companyIds,
          date_to_active: { [Op.gt]: currentBasicPackage[0].date_to_deactive }
        },
        include: [
          { model: Package, where: { type: 1 }, attributes: [] },
          { model: Transaction, where: { payment_status: '00' }, attributes: [] }
        ],
        order: [['date_to_active', 'asc']],
        group: ['date_to_active', 'date_to_deactive', 'transaction_id']
      });
      let incomingPackages = [];
      if (incomingBasicPackage.length) {
        incomingPackages = await Subscribement.findAll({
          attributes: ['date_to_active', 'date_to_deactive'],
          where: { transaction_id: incomingBasicPackage[0].transaction_id },
          include: { model: Package, where: { type: 2 } },
          group: ['date_to_active', 'date_to_deactive', 'package.id']
        });
      }
      const responses = {
        current: {
          total_location: currentBasicPackage.length,
          date_to_deactive: currentBasicPackage[0].date_to_deactive,
          company_ids: currentBasicPackage.map(val => val.company_id)
        },
        incoming: incomingBasicPackage.map(val => {
          return {
            date_to_active: val.date_to_active,
            duration: diffMonths(new Date(val.date_to_active), new Date(val.date_to_deactive))
          };
        }),
        incoming_packages: incomingPackages.map(val => {
          return {
            name: val.package.name,
            price: val.package.price,
            icon: val.package.icon,
            type: val.package.type,
            date_to_active: val.date_to_active
          };
        })
      };
      return res.status(200).json(response(true, 'Data langganan berhasil didapatkan', responses));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = subscribements;

const updatePromo = async (data, transaction) => {
  const response = {
    errorMessage: ''
  };
  // Update Promo
  if (data.promo && data.promo.visibility === 'private') {
    const promo = await Promo.findOne({
      attributes: ['id'],
      where: { id: data.promo.id },
      include: { model: PromoPrivate }
    });
    let usage = parseInt(promo.promo_private.usage) + 1;
    const updatePromoPrivate = await PromoPrivate.update(
      { usage },
      { where: { id: promo.promo_private.id } },
      { transaction }
    );
    if (!updatePromoPrivate) {
      response.errorMessage = 'Gagal mengajukan perpanjangan langganan';
    }
  }
  if (data.promo && data.promo.visibility === 'public') {
    const promo = await Promo.findOne({ where: { id: data.promo.id }, attributes: ['usage'] });
    let usage = parseInt(promo.usage) + 1;
    const updatePromo = await Promo.update(
      { usage },
      { where: { id: data.promo.id } },
      { transaction }
    );
    if (!updatePromo) {
      response.errorMessage = 'Gagal mengajukan perpanjangan langganan';
    }
  }
  return response;
};

const handleNicepay = async (data, transactionData, user, transaction) => {
  const response = {
    errorMessage: '',
    payload: ''
  };
  const host =
    process.env.NODE_ENV !== 'production' ? `https://${config.ngrok}` : `https://${config.host}`;
  const iMid = process.env.NODE_ENV !== 'production' ? 'IONPAYTEST' : process.env.NICEPAY_MID;
  const mkey = process.env.NODE_ENV !== 'production' ? '' : process.env.NICEPAY_MKEY;
  const merchantToken = await generateNicepayMercToken(
    iMid,
    mkey,
    transactionData.id,
    data.total_amount
  );
  const requestBody = {
    iMid,
    payMethod: '01',
    currency: 'IDR',
    amt: data.total_amount,
    instmntType: '1',
    instmntMon: '1',
    referenceNo: transactionData.id,
    goodsNm: 'Langganan Atenda Sakti',
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
    response.errorMessage = 'Gagal mengajukan langganan';
    return response;
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
  await Transaction.update({ url }, { where: { id: transactionData.id }, transaction });
  response.payload = payload;
  return response;
};

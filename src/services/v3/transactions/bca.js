require('module-alias/register');
const { response } = require('@helpers');
const { transactions: Transaction } = require('@models');

const bcaServices = {
  createVaTransaction: async (req, res) => {
    const { data } = req.body;
    const { users } = res.local;
    let transaction;
    try {
      // Check if current employee has unfinished transaction
      const checkTransaction = await Transaction.findOne({
        where: { parent_company_id: users.companyParentId, type: data.type, payment_status: '02' }
      });
      const payload = {
        ...data,
        parent_company_id: users.companyParentId,
        sub_company: '00000',
        payment_status: '02'
      };
      if (checkTransaction) {
        let today = new Date();
        transaction = await Transaction.update(
          { ...payload, created_at: today },
          {
            where: { id: checkTransaction.id }
          }
        );
        if (!transaction) {
          return res.status(400).json(response(false, 'Gagal melakukan pembayaran'));
        }
        transaction = await Transaction.findOne({ where: { id: checkTransaction.id } });
      } else {
        transaction = await Transaction.create(payload);
        if (!transaction) {
          return res.status(400).json(response(false, 'Gagal melakukan pembayaran'));
        }
      }
      const responses = {
        va_number: `11257${transaction.id}`
      };
      return res.status(201).json(response(true, 'Transaksi berhasil dibuat', responses));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  createMtTransaction: async (req, res) => {
    const { companyParentId } = res.local.users;
    const { data } = req.body;
    let transaction;
    try {
      const randomNumber = ('000' + Math.floor(Math.random() * Math.pow(10, 3))).substr(-3);
      const totalAmount = data.total_amount.toString().slice(0, -3) + randomNumber;

      const checkTransaction = await Transaction.findOne({
        where: { parent_company_id: companyParentId, type: data.type, payment_status: '02' }
      });

      const payload = {
        ...data,
        total_amount: totalAmount,
        parent_company_id: companyParentId,
        sub_company: '00000',
        payment_status: '02'
      };
      if (checkTransaction) {
        let today = new Date();
        transaction = await Transaction.update(
          { ...payload, created_at: today },
          {
            where: { id: checkTransaction.id }
          }
        );
        if (!transaction) {
          return res.status(400).json(response(false, 'Gagal melakukan pembayaran'));
        }
        transaction = await Transaction.findOne({ where: { id: checkTransaction.id } });
      } else {
        transaction = await Transaction.create(payload);
        if (!transaction) {
          return res.status(400).json(response(false, 'Gagal melakukan pembayaran'));
        }
      }
      transaction = await Transaction.findOne({ where: { id: transaction.id } });
      const responses = {
        id: transaction.id,
        total_amount: totalAmount,
        created_at: transaction.created_at
      };
      return res.status(201).json(response(true, 'Transaksi berhasil dibuat', responses));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = bcaServices;

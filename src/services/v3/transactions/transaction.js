require('module-alias/register');
const { response } = require('@helpers');
const { transactions: Transaction } = require('@models');

const transaction = {
  history: async (req, res) => {
    const { companyParentId } = res.local.users;
    const { type } = req.query;
    try {
      const getTransactions = await Transaction.findAll({
        where: { parent_company_id: companyParentId, type },
        attributes: [
          'id',
          'total_amount',
          'payment_method',
          'payment_status',
          'created_at',
          'id_description'
        ]
      });
      const responses = [];
      for (const data of getTransactions) {
        let paymentMethod = 'Kartu Kredit Visa';
        let paymentStatus = 'Menunggu';
        if (data.payment_method === 'va') paymentMethod = 'Virtual Account BCA';
        if (data.payment_method === 'mt') paymentMethod = 'Transfer BCA';
        if (data.payment_status === '01') paymentStatus = 'Dibatalkan';
        if (data.payment_status === '00') paymentStatus = 'Berhasil';
        if (data.payment_status === '02') paymentStatus = 'Menunggu';
        responses.push({
          id: data.id,
          description: data.id_description,
          payment_method: paymentMethod,
          payment_status: paymentStatus,
          total_amount: data.total_amount,
          created_at: data.created_at
        });
      }
      return res
        .status(200)
        .json(response(true, 'Daftar transaksi berhasil didapatkan', responses));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  checkStatus: async (req, res) => {
    const { transactionId } = req.params;
    try {
      const transaction = await Transaction.findOne({ where: { id: transactionId } });
      if (!transaction) {
        return res.status(400).json(response(false, 'Transaksi tidak di temukan'));
      }

      const responses = {
        id: transaction.id,
        total_amount: transaction.total_amount,
        payment_status: transaction.payment_status,
        type: transaction.type,
        payment_method: transaction.payment_method,
        id_description: transaction.id_description,
        en_description: transaction.en_description,
        created_at: transaction.created_at
      };
      return res
        .status(200)
        .json(response(true, 'Status transaksi berhasil di dapatkan', responses));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = transaction;

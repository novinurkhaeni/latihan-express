require('module-alias/register');
const { Sequelize } = require('sequelize');
const { response } = require('@helpers');
const {
  journals: Journal,
  transactions: Transactions,
  companies: Company,
  employees: Employee,
  users: User,
  subscribements: Subscribement
} = require('@models');
const EVENT = require('../../../eventemitter/constants');
const { observe } = require('../../../eventemitter');

const vaService = {
  bill: async (req, res) => {
    const { CompanyCode, CustomerNumber, RequestID, ChannelType } = req.body;
    try {
      // Check Transaction Existing
      const checkTransaction = await Transactions.findOne({
        where: { id: CustomerNumber },
        include: {
          model: Employee,
          attributes: ['id'],
          include: { model: User, attributes: ['full_name'] }
        }
      });
      let responses = {
        CompanyCode,
        CustomerNumber,
        RequestID,
        CustomerName: checkTransaction ? checkTransaction.employee.user.full_name : 'n/a',
        CurrencyCode: 'IDR',
        TotalAmount: checkTransaction ? checkTransaction.total_amount.toFixed(2) : '0.00',
        SubCompany: '00000',
        FreeTexts: [],
        AdditionalData: ''
      };
      if (!checkTransaction) {
        responses = {
          ...responses,
          InquiryStatus: '01',
          InquiryReason: {
            Indonesian: 'Transaksi tidak ditemukan',
            English: 'Transaction not found'
          },
          DetailBills: []
        };
        return res.status(400).json(responses);
      }
      if (checkTransaction && checkTransaction.payment_status === '00') {
        responses = {
          ...responses,
          InquiryStatus: '01',
          InquiryReason: {
            Indonesian: 'Transaksi sudah dilakukan',
            English: 'Transaction has already done'
          },
          DetailBills: []
        };
        return res.status(400).json(responses);
      } else if (checkTransaction && checkTransaction.payment_status === '01') {
        responses = {
          ...responses,
          InquiryStatus: '01',
          InquiryReason: {
            Indonesian: 'Transaksi sudah kadaluarsa',
            English: 'Transaction has been expired'
          },
          DetailBills: []
        };
        return res.status(400).json(responses);
      }
      const updateTransaction = await Transactions.update(
        {
          company_code: CompanyCode,
          request_id: RequestID,
          channel_type: ChannelType
        },
        { where: { id: CustomerNumber } }
      );
      if (!updateTransaction) {
        responses = {
          ...responses,
          InquiryStatus: '01',
          InquiryReason: {
            Indonesian: 'Terjadi kesalahan sistem',
            English: 'System error happen'
          },
          DetailBills: []
        };
        return res.status(400).json(responses);
      }
      responses = {
        ...responses,
        InquiryStatus: '00',
        InquiryReason: {
          Indonesian: 'Sukses',
          English: 'Success'
        },
        DetailBills: []
        // DetailBills: [
        //   {
        //     BillDescription: {
        //       Indonesian: checkTransaction.id_description,
        //       English: checkTransaction.en_description
        //     },
        //     BillAmount: checkTransaction.total_amount.toFixed(2),
        //     BillNumber: checkTransaction.id,
        //     BillSubCompany: checkTransaction.sub_company
        //   }
        // ]
      };
      return res.status(201).json(responses);
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  payment: async (req, res) => {
    const {
      CompanyCode,
      CustomerNumber,
      RequestID,
      PaidAmount,
      TotalAmount,
      TransactionDate
    } = req.body;
    try {
      let isSuccess = true;
      const transDate = TransactionDate.split(' ')[0];
      // Check Transaction Existing
      const checkTransaction = await Transactions.findOne({
        where: { id: CustomerNumber },
        include: {
          model: Employee,
          attributes: ['id'],
          include: [
            {
              model: User,
              attributes: ['full_name']
            },
            {
              model: Company,
              attributes: ['id']
            }
          ]
        }
      });
      let responses = {
        CompanyCode,
        CustomerNumber,
        RequestID,
        CustomerName: checkTransaction.employee.user.full_name,
        CurrencyCode: 'IDR',
        PaidAmount,
        TotalAmount: checkTransaction.total_amount.toFixed(2),
        TransactionDate,
        FreeTexts: [],
        AdditionalData: ''
      };
      if (checkTransaction && checkTransaction.payment_status === '00') {
        responses = {
          ...responses,
          PaymentFlagStatus: '01',
          PaymentFlagReason: {
            Indonesian: 'Transaksi sudah dilakukan',
            English: 'Transaction has already done'
          },
          DetailBills: []
        };
        isSuccess = false;
      } else if (checkTransaction && checkTransaction.payment_status === '01') {
        responses = {
          ...responses,
          PaymentFlagStatus: '01',
          PaymentFlagReason: {
            Indonesian: 'Transaksi sudah kadaluarsa',
            English: 'Transaction has been expired'
          },
          DetailBills: []
        };
        isSuccess = false;
      } else if (checkTransaction && checkTransaction.total_amount.toFixed(2) !== TotalAmount) {
        responses = {
          ...responses,
          PaymentFlagStatus: '01',
          PaymentFlagReason: {
            Indonesian: 'Nilai tagihan berbeda',
            English: 'Bill amount doesnt match'
          },
          DetailBills: []
        };
        isSuccess = false;
      } else {
        const updateTransaction = await Transactions.update(
          {
            paid_amount: parseInt(PaidAmount).toFixed(0),
            payment_status: '00'
          },
          { where: { id: CustomerNumber } }
        );
        if (!updateTransaction) {
          responses = {
            ...responses,
            PaymentFlagStatus: '01',
            PaymentFlagReason: {
              Indonesian: 'Terjadi kesalahan sistem',
              English: 'System error happen'
            },
            DetailBills: []
          };
          isSuccess = false;
        }
      }

      if (isSuccess) {
        responses = {
          ...responses,
          PaymentFlagStatus: '00',
          PaymentFlagReason: {
            Indonesian: 'Sukses',
            English: 'Success'
          },
          DetailBills: [
            {
              BillNumber: checkTransaction.id,
              Status: '00',
              Reason: {
                Indonesian: 'Sukses',
                English: 'Success'
              }
            }
          ]
        };

        if (checkTransaction.type == 1) {
          await Journal.create({
            employee_id: checkTransaction.employee_id,
            company_id: checkTransaction.employee.company.id,
            type: 'payment',
            debet: 0,
            kredit: 0,
            description: checkTransaction.id_description,
            balance: 1,
            created_at: checkTransaction.created_at,
            updated_at: checkTransaction.updated_at
          });
        }

        if (checkTransaction.type == 2) {
          // Find Related Company Ids with Transaction
          let companyIds = [];
          const subscribements = await Subscribement.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('company_id')), 'company_id']],
            where: { transaction_id: checkTransaction.id }
          });
          companyIds = subscribements.map(val => val.company_id);
          for (const companyId of companyIds) {
            await Company.update({ active: 1 }, { where: { id: companyId } });
          }
        }
      }

      if (!isSuccess) {
        return res.status(400).json(responses);
      }

      observe.emit(EVENT.PAYMENT, {
        employeeId: checkTransaction.employee_id,
        title: `Pembayaran ${checkTransaction.type === 1 ? 'GajianDulu' : 'Atenda Sakti'}`,
        transaction_id: checkTransaction.id,
        description: `${checkTransaction.id_description} pada ${transDate} telah berhasil dibayar`,
        type: checkTransaction.type,
        payment_method: 'va',
        status: '00'
      });

      return res.status(201).json(responses);
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = vaService;

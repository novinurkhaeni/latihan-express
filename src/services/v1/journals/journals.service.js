require('module-alias/register');
const { response } = require('@helpers');
const {
  journals: Journal,
  journal_details: JournalDetail,
  employees: Employee,
  users: User
} = require('@models');
const EVENT = require('../../../eventemitter/constants');
const { observe } = require('../../../eventemitter');

const journalService = {
  post: async (req, res) => {
    const { employee_id } = req.params;
    const { data } = req.body;
    try {
      const payload = Object.assign({}, data, { employee_id });
      const journals = await Journal.create(payload);

      if (!journals) {
        return res.status(400).json(response(false, `Journal data not created`));
      }
      return res
        .status(201)
        .json(response(true, 'Journal data has been successfully created', journals));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  //ADMIN ACCESS
  rejectWithdraw: async (req, res) => {
    const { withdraw_id: id } = req.params;
    const { data } = req.body;
    try {
      const updateStatus = await JournalDetail.update(data, {
        where: { id }
      });
      if (updateStatus > 0) {
        const result = await JournalDetail.findOne({
          where: { id },
          include: {
            model: Journal,
            include: {
              model: Employee,
              include: { model: User },
              attributes: ['id', 'user_id']
            }
          }
        });

        const withdrawDate = new Date(result.created_at);
        await observe.emit(EVENT.WITHDRAW_REJECTED, {
          userId: result.journal.employee.user.id,
          userEmail: result.journal.employee.user.email,
          employeeId: result.journal.employee.id,
          withdrawId: result.id,
          totalWithdraw: result.total,
          withdrawDate: `${withdrawDate.getFullYear()}-${(
            '0' +
            (withdrawDate.getMonth() + 1)
          ).slice(-2)}-${('0' + withdrawDate.getDate()).slice(-2)}`
        });

        return res.status(200).json(response(true, 'Withdraw status updated'));
      }
      return res.status(400).json(response(false, 'Failed update withdraw status'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = journalService;

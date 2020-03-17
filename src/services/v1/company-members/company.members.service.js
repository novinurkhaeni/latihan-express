/* eslint-disable indent */
require('module-alias/register');
const {
  response,
  dateProcessor: { getRangedDate }
} = require('@helpers');
const {
  employees: Employee,
  users: User,
  presences: Presence,
  journals: Journal,
  digital_assets: DigitalAsset,
  journal_details: JournalDetail,
  companies: Company,
  company_settings: CompanySetting
} = require('@models');
const Sequelize = require('sequelize');
const { Op } = Sequelize;

const companyMemberService = {
  getAn: async (req, res) => {
    const { company_id: companyId } = req.params;
    const { dateStart, dateEnd } = req.query;
    const companyIdArr = companyId.split(',');
    try {
      const members = [];
      let company;
      if (companyIdArr.length) {
        company = await Company.findOne({
          where: { id: companyIdArr[0] },
          include: {
            model: CompanySetting,
            as: 'setting',
            attributes: ['payroll_date']
          }
        });
      }

      const userData = await Employee.findAll({
        attributes: ['id', 'flag', 'role', 'date_start_work', 'active'],
        where: { company_id: companyIdArr },
        include: [
          {
            model: User,
            attributes: ['full_name', 'email', 'phone']
          },
          {
            model: Journal,
            attributes: ['debet', 'kredit', 'employee_id'],
            separate: true,
            where: [
              Sequelize.where(
                Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), '%Y-%m-%d'),
                '>=',
                dateStart
              ),
              Sequelize.where(
                Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), '%Y-%m-%d'),
                '<=',
                dateEnd
              ),
              {
                type: {
                  $notIn: ['withdraw', 'subscribe', 'payment', 'fee']
                },
                on_hold: 0
              }
            ],
            required: false
          },
          {
            model: Presence,
            attributes: ['work_hours', 'employee_id'],
            separate: true,
            where: {
              presence_date: {
                $between: [dateStart, dateEnd]
              }
            },
            required: false
          },
          {
            model: DigitalAsset,
            required: false,
            attributes: ['url', 'type'],
            where: {
              type: 'avatar'
            },
            as: 'assets'
          },
          {
            model: Company,
            required: false,
            attributes: ['company_name', 'name', 'id']
          }
        ]
      });

      userData.sort((prev, next) => {
        // Sort By Branch Id ASC
        if (prev.company.id < next.company.id) return -1;
        if (prev.company.id > next.company.id) return 1;
        // Sort By Tanggal Masuk Kerja ASC
        if (prev.date_start_work < next.date_start_work) return -1;
        if (prev.date_start_work > next.date_start_work) return 1;
        // Sort By Name Id ASC
        if (prev.user.full_name < next.user.full_name) return -1;
        if (prev.user.full_name > next.user.full_name) return 1;
      });

      for (let i = 0; i < userData.length; i++) {
        const memberData = Object.assign(
          {},
          {
            id: userData[i].id,
            full_name: userData[i].user.full_name,
            email: userData[i].user.email,
            phone: userData[i].user.phone,
            flag: userData[i].flag,
            active: userData[i].active,
            role: userData[i].role,
            assets: userData[i].assets,
            company: userData[i].company.company_name || userData[i].company.name,
            end_date: getRangedDate(company.setting.payroll_date).dateEnd,
            salary_summary: {
              workhour: 0
            }
          }
        );
        members.push(memberData);
      }

      return res
        .status(200)
        .json(response(true, 'Member list been successfully retrieved', members));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  lists: async (req, res) => {
    const { company_id: companyId } = req.params;
    const companyIds = companyId.split(',');
    try {
      const memberLists = await User.findAll({
        attributes: ['id', 'full_name', 'email', 'phone'],
        include: [
          {
            model: Employee,
            attributes: ['id', 'flag', 'role'],
            where: { company_id: companyIds, flag: 3, active: 1 },
            include: [
              {
                model: DigitalAsset,
                required: false,
                attributes: ['url', 'type'],
                where: {
                  type: 'avatar'
                },
                as: 'assets'
              },
              { model: Company, attributes: ['id', 'name', 'company_name'] }
            ]
          }
        ]
      });
      memberLists.sort((a, b) =>
        a.employees[0].company.id > b.employees[0].company.id
          ? 1
          : b.employees[0].company.id > a.employees[0].company.id
          ? -1
          : 0
      );
      const members = [];
      for (let i = 0; i < memberLists.length; i++) {
        const payload = Object.assign(
          {},
          {
            id: memberLists[i].employees[0]['id'],
            full_name: memberLists[i]['full_name'],
            email: memberLists[i]['email'],
            phone: memberLists[i]['phone'],
            flag: memberLists[i].employees[0]['flag'],
            role: memberLists[i].employees[0]['role'],
            assets: memberLists[i].employees[0]['assets'],
            company: memberLists[i].employees[0]['company']
          }
        );
        members.push(payload);
      }

      return res
        .status(200)
        .json(response(true, 'Member lists been successfully retrieved', members));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  get: async (req, res) => {
    const { company_id: companyId } = req.params;

    try {
      const dateNow = new Date();
      const firstDateThisMonth = new Date(dateNow.getFullYear(), dateNow.getMonth(), 1);
      const lastDateThisMonth = new Date(dateNow.getFullYear(), dateNow.getMonth() + 1, 1);
      const year = dateNow.getFullYear();
      const month = ('0' + (dateNow.getMonth() + 1)).slice(-2);

      const userData = await User.findAll({
        attributes: ['id', 'full_name', 'email', 'phone'],
        include: [
          {
            model: Employee,
            attributes: ['id', 'flag', 'role'],
            where: { company_id: companyId },
            include: [
              {
                model: Journal,
                attributes: ['debet', 'kredit'],
                where: {
                  created_at: {
                    [Op.gte]: firstDateThisMonth,
                    [Op.lte]: lastDateThisMonth
                  },
                  $not: {
                    type: 'withdraw'
                  }
                },
                required: false
              },
              {
                model: Presence,
                attributes: ['work_hours'],
                where: {
                  presence_date: {
                    [Op.gte]: firstDateThisMonth,
                    [Op.lte]: lastDateThisMonth
                  }
                },
                required: false
              },
              {
                model: DigitalAsset,
                required: false,
                attributes: ['url', 'type'],
                where: {
                  type: 'avatar'
                },
                as: 'assets'
              }
            ]
          }
        ]
      });

      const members = [];
      for (let i = 0; i < userData.length; i++) {
        let depositTotal = 0;
        const withdrawData = await JournalDetail.findAll({
          where: { status: 1 },
          include: {
            model: Journal,
            attributes: ['type', 'employee_id', 'description'],
            where: [
              { employee_id: userData[i].employees[0].id, type: 'withdraw' },
              Sequelize.where(
                Sequelize.fn('DATE_FORMAT', Sequelize.col('journal_details.created_at'), '%Y-%c'),
                `${dateNow.getFullYear()}-${dateNow.getMonth() + 1}`
              )
            ]
          }
        });
        if (withdrawData.length) {
          for (let i = 0; i < withdrawData.length; i++) {
            depositTotal += withdrawData[i].total;
          }
        }

        let workhours = 0;
        userData[i].employees[0].presences.forEach(presence => {
          workhours += presence['work_hours'];
        });
        let salaries = 0;
        userData[i].employees[0].journals.forEach(journal => {
          salaries += journal['debet'];
          salaries -= journal['kredit'];
        });
        const memberData = Object.assign(
          {},
          {
            id: userData[i].employees[0]['id'],
            full_name: userData[i]['full_name'],
            email: userData[i]['email'],
            phone: userData[i]['phone'],
            flag: userData[i].employees[0]['flag'],
            role: userData[i].employees[0]['role'],
            salary_summary: {
              month: month,
              year: year,
              nett_salary: salaries - depositTotal,
              workhour: workhours
            },
            assets: userData[i].employees[0]['assets']
          }
        );
        members.push(memberData);
      }

      return res
        .status(200)
        .json(response(true, 'Member list been successfully retrieved', members));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = companyMemberService;

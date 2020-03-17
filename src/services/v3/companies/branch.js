require('module-alias/register');
const { response } = require('@helpers');
const {
  sequelize,
  Sequelize,
  companies: Company,
  company_settings: CompanySetting,
  digital_assets: DigitalAsset,
  employees: Employee,
  users: User
} = require('@models');
const { Op } = Sequelize;
const config = require('config');

class Branch {
  constructor(req, res) {
    this.req = req;
    this.res = res;
  }

  async getBranch() {
    const { company_id } = this.req.params;
    try {
      const company = await Company.findOne({
        where: { id: company_id },
        include: [
          {
            model: DigitalAsset,
            as: 'assets'
          },
          {
            model: Employee,
            attributes: ['id', 'role'],
            required: false,
            where: { role: { [Op.or]: [3, 4] } },
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
              { model: User, attributes: ['full_name'] }
            ]
          }
        ]
      });
      if (!company) {
        return this.res.status(400).json(response(false, 'Perusahaan tidak ditemukan'));
      }

      const url = company.assets ? company.assets.url : null;
      const payload = {
        id: company.id,
        codename: company.codename,
        parent_company_id: company.parent_company_id,
        company_name: company.company_name,
        renew: company.renew === 1,
        name: company.name,
        phone: company.phone,
        address: company.address,
        timezone: company.timezone,
        location: company.location,
        unique_id: company.unique_id,
        url,
        managers: company.employees
          .filter(val => val.role === 3)
          .map(val => {
            return {
              id: val.id,
              full_name: val.user.full_name,
              avatar: val.assets
            };
          }),
        supervisors: company.employees
          .filter(val => val.role === 4)
          .map(val => {
            return {
              id: val.id,
              full_name: val.user.full_name,
              avatar: val.assets
            };
          })
      };
      return this.res.status(200).json(response(true, 'data lokasi berhasil di dapatkan', payload));
    } catch (error) {
      if (error.errors) {
        return this.res.status(400).json(response(false, error.errors));
      }
      return this.res.status(400).json(response(false, error.message));
    }
  }

  async editBranch() {
    const { body: data, file } = this.req;
    const { company_id } = this.req.params;
    const {
      users: { companyParentId }
    } = this.res.local;
    const host =
      process.env.NODE_ENV !== 'production'
        ? `http://${config.host}:${config.port}/`
        : `https://${config.host}/`;
    const transaction = await sequelize.transaction();
    try {
      const company = await Company.findOne({
        where: { id: company_id },
        include: [
          {
            model: DigitalAsset,
            as: 'assets'
          }
        ]
      });
      if (!company) {
        return this.res.status(400).json(response(false, 'Perusahaan tidak ditemukan'));
      }
      data['parent_company_id'] = companyParentId;
      let finalCode;
      const dataName = data.company_name ? data.company_name : company.name;

      let codeName = dataName
        .match(/(?![EIOU])[B-Z]/gi)
        .toString()
        .replace(/,/g, '')
        .substring(0, 3)
        .toUpperCase();
      if (codeName.length < 3) {
        const long = 3 - codeName.length;
        codeName = codeName + 'X'.repeat(long);
      }

      const isCodenameUsed = await Company.findOne({
        order: [['codename', 'DESC']],
        where: { codename: { [Op.regexp]: `${codeName}[0-9]` } }
      });

      if (isCodenameUsed) {
        let lastNums = isCodenameUsed.codename.substr(-3);
        lastNums = parseInt(lastNums);
        lastNums++;
        lastNums = ('0000' + lastNums).substr(-3);
        finalCode = codeName + lastNums;
      } else {
        const lastNum = '001';
        finalCode = codeName + lastNum;
      }

      const currentCodeName = company.codename.slice(0, 3);

      //if current code name different with payload code name then do update, else do not update code name
      if (codeName !== currentCodeName) {
        data['codename'] = finalCode;
      }

      const companyUpdate = await Company.update(data, {
        where: { id: company.id },
        returning: true,
        transaction
      });
      if (!companyUpdate) {
        transaction.rollback();
        return this.res.status(400).json(response(false, 'data lokasi gagal di ubah'));
      }

      let location;
      let digitalAssetPayload = {
        type: 'avatar',
        uploadable_id: company.id,
        uploadable_type: 'companies'
      };

      // This will handle file as blob from client
      if (file) {
        const normalizePath = file.path.replace(/\\/g, '/');
        location = normalizePath.split('/')[1];
        digitalAssetPayload['path'] = normalizePath;
        digitalAssetPayload['filename'] = file.filename;
        digitalAssetPayload['mime_type'] = file.mimetype;
        digitalAssetPayload['url'] = `${host}${location}/${file.filename}`;
      } else {
        if (data.url) {
          const filename = data.url.split('/')[4];
          const path = config.uploads + '/' + filename;
          const mimeType = 'image/' + filename.split('.')[1];
          digitalAssetPayload['path'] = path;
          digitalAssetPayload['filename'] = filename;
          digitalAssetPayload['mime_type'] = mimeType;
          digitalAssetPayload['url'] = data.url;
        }
      }

      //if data url and file not exist skip update or create digital asset
      if (data.url || file) {
        //if company already have digital asset do update if not do create
        if (company.assets) {
          const digitalAssetUpdate = await DigitalAsset.update(digitalAssetPayload, {
            where: {
              uploadable_id: company.id,
              uploadable_type: 'companies',
              type: 'avatar'
            },
            returning: true,
            transaction
          });

          if (!digitalAssetUpdate) {
            await transaction.rollback();
            return this.res.status(400).json(response(false, 'data lokasi gagal di ubah'));
          }
        } else {
          const digitalAssetCreate = await DigitalAsset.create(digitalAssetPayload, {
            transaction
          });

          if (!digitalAssetCreate) {
            await transaction.rollback();
            return this.res.status(400).json(response(false, 'data lokasi gagal di ubah'));
          }
        }
      }
      transaction.commit();
      return this.res.status(200).json(response(true, 'data lokasi berhasil di ubah'));
    } catch (error) {
      transaction.rollback();
      if (error.errors) {
        return this.res.status(400).json(response(false, error.errors));
      }
      return this.res.status(400).json(response(false, error.message));
    }
  }

  async createBranch() {
    const { body: data, file } = this.req;
    const { company_id } = this.req.params;
    const {
      users: { companyParentId }
    } = this.res.local;
    const host =
      process.env.NODE_ENV !== 'production'
        ? `http://${config.host}:${config.port}/`
        : `https://${config.host}/`;
    const transaction = await sequelize.transaction();
    try {
      const company = await Company.findOne({
        where: { id: company_id },
        include: [
          {
            model: CompanySetting,
            as: 'setting'
          }
        ]
      });
      if (!company) {
        return this.res.status(400).json(response(false, 'Perusahaan tidak ditemukan'));
      }
      data['parent_company_id'] = companyParentId;
      const { setting } = company;
      let finalCode;
      const dataName = data.company_name ? data.company_name : data.name;

      const companySettingPayload = {
        notif_presence_overdue: setting ? setting.notif_presence_overdue : 0,
        presence_overdue_limit: setting ? setting.presence_overdue_limit : 0,
        overwork_limit: setting ? setting.overwork_limit : 0,
        notif_overwork: setting ? setting.notif_overwork : 0,
        rest_limit: setting ? setting.rest_limit : 0,
        notif_work_schedule: setting ? setting.notif_work_schedule : 0,
        automated_payroll: setting ? setting.automated_payroll : 0,
        payroll_date: setting ? setting.payroll_date : 0,
        late_deduction: setting ? setting.late_deduction : 0,
        home_early_deduction: setting ? setting.home_early_deduction : 0
      };

      let location;
      let digitalAssetPayload = {
        type: 'avatar',
        uploadable_type: 'companies'
      };

      // This will handle file as blob from client
      if (file) {
        const normalizePath = file.path.replace(/\\/g, '/');
        location = normalizePath.split('/')[1];
        digitalAssetPayload['path'] = normalizePath;
        digitalAssetPayload['filename'] = file.filename;
        digitalAssetPayload['mime_type'] = file.mimetype;
        digitalAssetPayload['url'] = `${host}${location}/${file.filename}`;
      } else {
        if (data.url) {
          const filename = data.url.split('/')[4];
          const path = config.uploads + '/' + filename;
          const mimeType = 'image/' + filename.split('.')[1];
          digitalAssetPayload['path'] = path;
          digitalAssetPayload['filename'] = filename;
          digitalAssetPayload['mime_type'] = mimeType;
          digitalAssetPayload['url'] = data.url;
        }
      }

      let codeName = dataName
        .match(/(?![EIOU])[B-Z]/gi)
        .toString()
        .replace(/,/g, '')
        .substring(0, 3)
        .toUpperCase();
      if (codeName.length < 3) {
        const long = 3 - codeName.length;
        codeName = codeName + 'X'.repeat(long);
      }

      const companyExist = await Company.findOne({
        order: [['codename', 'DESC']],
        where: { codename: { [Op.regexp]: `${codeName}[0-9]` }, registration_complete: 0 },
        include: [
          {
            model: CompanySetting,
            as: 'setting'
          },
          {
            model: DigitalAsset,
            required: false,
            as: 'assets'
          }
        ]
      });

      if (companyExist) {
        const payload = Object.assign({}, data, {
          registration_complete: 1,
          active: 0
        });
        const companyUpdate = await Company.update(payload, {
          where: { id: companyExist.id },
          transaction
        });

        if (!companyUpdate) {
          await transaction.rollback();
          return this.res.status(400).json(response(false, 'Gagal membuat lokasi baru'));
        }

        const companySettingUpdate = await CompanySetting.update(companySettingPayload, {
          where: { id: companyExist.setting.id },
          transaction
        });

        if (!companySettingUpdate) {
          await transaction.rollback();
          return this.res.status(400).json(response(false, 'Gagal membuat lokasi baru'));
        }
        digitalAssetPayload['uploadable_id'] = companyExist.id;
        //if data url and file not exist skip update or create digital asset
        if (data.url || file) {
          //if company already have digital asset do update if not do create
          if (companyExist.assets) {
            const digitalAssetUpdate = await DigitalAsset.update(digitalAssetPayload, {
              where: {
                uploadable_id: companyExist.id,
                uploadable_type: 'companies',
                type: 'avatar'
              },
              transaction
            });

            if (!digitalAssetUpdate) {
              await transaction.rollback();
              return this.res.status(400).json(response(false, 'Gagal membuat lokasi baru'));
            }
          } else {
            const digitalAssetCreate = await DigitalAsset.create(digitalAssetPayload, {
              transaction
            });

            if (!digitalAssetCreate) {
              await transaction.rollback();
              return this.res.status(400).json(response(false, 'Gagal membuat lokasi baru'));
            }
          }
        }
      } else {
        const isCodenameUsed = await Company.findOne({
          order: [['codename', 'DESC']],
          where: { codename: { [Op.regexp]: `${codeName}[0-9]` } }
        });

        if (isCodenameUsed) {
          let lastNums = isCodenameUsed.codename.substr(-3);
          lastNums = parseInt(lastNums);
          lastNums++;
          lastNums = ('0000' + lastNums).substr(-3);
          finalCode = codeName + lastNums;
        } else {
          const lastNum = '001';
          finalCode = codeName + lastNum;
        }

        const newBranchPaylaod = {
          parent_company_id: data.parent_company_id,
          codename: finalCode,
          company_name: data.company_name,
          name: data.name,
          timezone: data.timezone,
          unique_id: data.unique_id,
          address: data.address,
          phone: data.phone,
          location: data.location,
          active: 0,
          registration_complete: 1
        };
        const createBranch = await Company.create(newBranchPaylaod, { transaction });
        if (!createBranch) {
          await transaction.rollback();
          return this.res.status(400).json(response(false, 'Gagal membuat lokasi baru'));
        }

        companySettingPayload['company_id'] = createBranch.id;
        digitalAssetPayload['uploadable_id'] = createBranch.id;

        const createCompanySetting = await CompanySetting.create(companySettingPayload, {
          transaction
        });
        if (!createCompanySetting) {
          await transaction.rollback();
          return this.res.status(400).json(response(false, 'Gagal membuat lokasi baru'));
        }

        //if data url and file not exist skip create digital asset
        if (data.url || file) {
          const createDigitalAsset = await DigitalAsset.create(digitalAssetPayload, {
            transaction
          });

          if (!createDigitalAsset) {
            await transaction.rollback();
            return this.res.status(400).json(response(false, 'Gagal membuat lokasi baru'));
          }
        }
      }

      await transaction.commit();
      return this.res.status(201).json(response(true, 'Lokasi baru berhasil dibuat'));
    } catch (error) {
      await transaction.rollback();
      if (error.errors) {
        return this.res.status(400).json(response(false, error.errors));
      }
      return this.res.status(400).json(response(false, error.message));
    }
  }
}

module.exports = Branch;

require('module-alias/register');
const { response } = require('@helpers');
const { sequelize, abilities_category: AbilitiesCategory } = require('@models');

class CompanyAbility {
  constructor(req, res) {
    this.req = req;
    this.res = res;
  }

  async editCompaniesAbilities() {
    const { data } = this.req.body;
    const { company_ids } = this.req.params;
    const companyIds = company_ids.split(',');
    const roleStruct = [
      { role: 3, roleName: 'manager' },
      { role: 4, roleName: 'supervisor' },
      { role: 5, roleName: 'hrd' },
      { role: 6, roleName: 'leader' }
    ];
    const transaction = await sequelize.transaction();
    try {
      // 3 Manager - 4 Supervisor - 6 Leader
      const existingAbility = await AbilitiesCategory.findAll({
        where: {
          company_id: companyIds,
          role: [3, 4, 5, 6]
        }
      });

      for (const role of roleStruct) {
        const isAbilityExist = existingAbility.find(val => val.role === role.role);
        if (isAbilityExist) {
          const updateAbility = await AbilitiesCategory.update(
            { ability: data[role.roleName] },
            { where: { company_id: companyIds, role: role.role } },
            { transaction }
          );
          if (!updateAbility) {
            await transaction.rollback();
            return this.res.status(400).json(response(false, 'Data kemampuan peran gagal diubah'));
          }
        } else {
          let payload = [];
          for (const companyId of companyIds) {
            payload.push({ company_id: companyId, role: role.role, ability: data[role.roleName] });
          }
          const createAbility = await AbilitiesCategory.bulkCreate(payload);
          if (!createAbility) {
            await transaction.rollback();
            return this.res.status(400).json(response(false, 'Data kemampuan peran gagal diubah'));
          }
        }
      }
      await transaction.commit();
      return this.res.status(200).json(response(true, 'Data kemampuan peran berhasil diubah'));
    } catch (error) {
      await transaction.rollback();
      if (error.errors) {
        return this.res.status(400).json(response(false, error.errors));
      }
      return this.res.status(400).json(response(false, error.message));
    }
  }
}

module.exports = CompanyAbility;

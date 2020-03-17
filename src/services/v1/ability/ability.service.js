require('module-alias/register');
const { abilities: Abilities, users: User, employees: Employee } = require('@models');
const { response, abilityFinder } = require('@helpers');

const abilityService = {
  get: async (req, res) => {
    const { id } = res.local.users;
    try {
      const employee = await Employee.findOne({
        attributes: ['id', 'flag', 'role', 'company_id'],
        include: [{ model: User, where: { id } }, { model: Abilities }]
      });
      const payload = {
        ability: await abilityFinder(employee)
      };
      return res
        .status(200)
        .json(response(true, 'Ability has been successfully retreived', payload));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = abilityService;

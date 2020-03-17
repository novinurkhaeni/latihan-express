require('module-alias/register');
const { abilities_category: AbilitiesCategory } = require('@models');

const abilityFinder = async employee => {
  let getCategory;
  if (employee.company_id) {
    getCategory = await AbilitiesCategory.findOne({
      where: { company_id: employee.company_id, role: employee.role }
    });
  }

  const getStandardAbility = await AbilitiesCategory.findOne({
    where: { company_id: null, role: employee.role },
    attibutes: ['ability']
  });

  let ability = '';
  if (getCategory) {
    ability = getCategory.ability;
  } else {
    ability = getStandardAbility ? getStandardAbility.ability : '';
  }

  if (employee.ability) {
    if (employee.ability.type && employee.ability.ability) {
      ability = employee.ability.ability;
    } else if (getCategory) {
      ability = getCategory.ability;
    }
  }
  return ability;
};

module.exports = abilityFinder;

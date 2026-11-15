require('dotenv').config();

function getRequiredValue(name, allowEmpty = false) {
  const environmentValue = process.env[name];
  if (environmentValue == null || (!allowEmpty && !environmentValue.trim())) {
    throw new Error(`Missing required environment variable: ${name}.`);
  }
  return environmentValue;
}

function getIntegerValue(name, minimum) {
  const integerValue = Number(getRequiredValue(name));
  if (!Number.isInteger(integerValue) || integerValue < minimum) {
    throw new Error(`${name} must be an integer greater than or equal to ${minimum}.`);
  }
  return integerValue;
}

module.exports = { getRequiredValue, getIntegerValue };

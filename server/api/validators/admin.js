const Joi = require("joi");

const currencyCode = Joi.string().trim().uppercase().length(3).required();

const historyParamsSchema = Joi.object({
  from: currencyCode,
  to: currencyCode,
}).unknown(false);

const idParamSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
}).unknown(false);

const listRatesQuerySchema = Joi.object({
  from: Joi.string().trim().uppercase().length(3).optional(),
  to: Joi.string().trim().uppercase().length(3).optional(),
  active: Joi.alternatives().try(Joi.boolean(), Joi.string().valid("true", "false")).optional(),
}).unknown(false);

const rateHistoryQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(365).default(30).optional(),
}).unknown(false);

const createExchangeRateSchema = Joi.object({
  fromCurrency: currencyCode,
  toCurrency: currencyCode,
  rate: Joi.number().positive().precision(8).required(),
  effectiveDate: Joi.date().iso().optional(),
  expiryDate: Joi.date().iso().optional(),
  provider: Joi.string().trim().max(100).optional(),
}).unknown(false);

const updateExchangeRateSchema = Joi.object({
  rate: Joi.number().positive().precision(8).optional(),
  expiryDate: Joi.date().iso().allow(null).optional(),
  isActive: Joi.boolean().optional(),
})
  .unknown(false)
  .min(1);

function validateListRatesQuery(data) {
  return listRatesQuerySchema.validate(data);
}

function validateRateHistoryParams(data) {
  return historyParamsSchema.validate(data);
}

function validateRateHistoryQuery(data) {
  return rateHistoryQuerySchema.validate(data);
}

function validateExchangeRateIdParam(data) {
  return idParamSchema.validate(data);
}

function validateCreateExchangeRate(data) {
  return createExchangeRateSchema.validate(data);
}

function validateUpdateExchangeRate(data) {
  return updateExchangeRateSchema.validate(data);
}

module.exports = {
  validateListRatesQuery,
  validateRateHistoryParams,
  validateRateHistoryQuery,
  validateExchangeRateIdParam,
  validateCreateExchangeRate,
  validateUpdateExchangeRate,
};

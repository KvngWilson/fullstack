const Joi = require("joi");
const { emailSchema, passwordSchema } = require("./common");

const validateVendorApplication = Joi.object({
  email: emailSchema.required(),
  password: passwordSchema.required(),
  confirmPassword: Joi.string()
    .valid(Joi.ref("password"))
    .required()
    .messages({
      "any.only": "Passwords must match",
    }),
  storeName: Joi.string().trim().min(2).max(100).required(),
  businessType: Joi.string().trim().required(),
  businessName: Joi.string().trim().min(2).max(200).required(),
  businessRegistration: Joi.string().trim().optional().allow("", null),
  taxId: Joi.string().trim().optional().allow("", null),
  contactPerson: Joi.string().trim().min(2).max(100).required(),
  phone: Joi.string().trim().required(),
  address: Joi.object().optional(),
  documents: Joi.array().optional(),
});

module.exports = {
  validateVendorApplication,
};

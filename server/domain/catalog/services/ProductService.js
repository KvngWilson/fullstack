const productRepository = require("../repositories/ProductRepository");
const categoryRepository = require("../repositories/CategoryRepository");
const BaseService = require("../../base/BaseService");
const { PricingPolicy } = require("../policies");
const { ProductCreated } = require("../events");
const PERMISSIONS = require("../../../shared/constants/permissions");
const logger = require("../../../shared/utils/logger");
const { fireAndForgetWithErrorLog } = require("../../../shared/utils/asyncErrorHandler");
const eventDispatcher = require("../../shared/events/dispatcher");

/**
 * Product Service
 * Manages product business logic and data access
 * Validates category existence before create/update operations
 */
class ProductService extends BaseService {
  constructor() {
    super();
  }
  async getById(id) {
    return productRepository.findById(id);
  }

  async getByIdWithVariants(id) {
    return productRepository.findByIdWithVariants(id);
  }

  async getAll(options = {}) {
    return productRepository.findAll(options);
  }

  async getFeatured(limit = 10) {
    return productRepository.findFeatured(limit);
  }

  async create(productData, employeeId = null) {
    // Permission validation
    if (employeeId) {
      await this.validatePermission(employeeId, PERMISSIONS.PRODUCT.CREATE);
    }

    if (productData.base_price !== undefined) {
      const pricingValidation = PricingPolicy.validatePrice(productData.base_price);
      if (!pricingValidation.valid) {
        throw new Error(pricingValidation.message);
      }
    }

    if (productData.category_id) {
      const categoryExists = await categoryRepository.exists(productData.category_id);
      if (!categoryExists) {
        throw new Error("Invalid category_id");
      }
    }

    const product = await productRepository.create(productData);

    const event = new ProductCreated({
      productId: product.id,
      name: product.name,
      categoryId: product.category_id,
    });

    fireAndForgetWithErrorLog(
      () => eventDispatcher.publish(event),
      {
        operation: 'publishProductCreatedEvent',
        id: product.id,
        severity: 'warn'
      }
    )

    // Audit log
    if (employeeId) {
      await this.auditLog(
        employeeId,
        "product:create",
        "product",
        product.id,
        { name: productData.name, category_id: productData.category_id }
      );
    }

    return product;
  }

  async update(id, productData, employeeId = null) {
    // Permission validation
    if (employeeId) {
      await this.validatePermission(employeeId, PERMISSIONS.PRODUCT.UPDATE);
    }

    if (productData.base_price !== undefined) {
      const pricingValidation = PricingPolicy.validatePrice(productData.base_price);
      if (!pricingValidation.valid) {
        throw new Error(pricingValidation.message);
      }
    }

    if (productData.category_id) {
      const categoryExists = await categoryRepository.exists(productData.category_id);
      if (!categoryExists) {
        throw new Error("Invalid category_id");
      }
    }

    const product = await productRepository.update(id, productData);

    // Audit log
    if (employeeId) {
      await this.auditLog(
        employeeId,
        "product:update",
        "product",
        id,
        { changes: productData }
      );
    }

    return product;
  }

  async delete(id, employeeId = null) {
    // Permission validation
    if (employeeId) {
      await this.validatePermission(employeeId, PERMISSIONS.PRODUCT.DELETE);
    }

    const deleted = await productRepository.delete(id, employeeId);

    // Audit log
    if (employeeId && deleted) {
      await this.auditLog(employeeId, "product:delete", "product", id, {
        deleted: true,
      });
    }

    return deleted;
  }

  async count(filters = {}) {
    return productRepository.count(filters);
  }
}

module.exports = new ProductService();

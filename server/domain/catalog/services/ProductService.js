const productRepository = require("../repositories/ProductRpository");
const categoryRepository = require("../repositories/CategoryRepository");
const BaseService = require("../../base/BaseService");
const { PricingPolicy } = require("../policies");
const { ProductCreated } = require("../events");
const productPolicy = require("../../../policies/productPolicy");
const logger = require("../../../shared/utils/logger");
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
      await this.validatePermission(employeeId, productPolicy.create);
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

    try {
      await eventDispatcher.publish(event);
      logger.debug("Catalog domain event published", {
        type: event.eventType || event.type,
        productId: product.id,
      });
    } catch (publishError) {
      logger.warn("Catalog domain event publish failed", {
        type: event.eventType || event.type,
        productId: product.id,
        error: publishError.message,
      });
    }

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
      await this.validatePermission(employeeId, productPolicy.update);
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
      await this.validatePermission(employeeId, productPolicy.delete);
    }

    await productRepository.delete(id, employeeId);

    // Audit log
    if (employeeId) {
      await this.auditLog(employeeId, "product:delete", "product", id, {
        deleted: true,
      });
    }
  }

  async count(filters = {}) {
    return productRepository.count(filters);
  }
}

module.exports = new ProductService();

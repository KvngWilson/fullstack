const productRepository = require("../repositories/ProductRpository");
const categoryRepository = require("../repositories/CategoryRepository");

/**
 * Product Service
 * Manages product business logic and data access
 * Validates category existence before create/update operations
 */
class ProductService {
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

  async create(productData) {
    if (productData.category_id) {
      const categoryExists = await categoryRepository.exists(productData.category_id);
      if (!categoryExists) {
        throw new Error("Invalid category_id");
      }
    }

    return productRepository.create(productData);
  }

  async update(id, productData) {
    if (productData.category_id) {
      const categoryExists = await categoryRepository.exists(productData.category_id);
      if (!categoryExists) {
        throw new Error("Invalid category_id");
      }
    }

    return productRepository.update(id, productData);
  }

  async delete(id, actorUserId) {
    return productRepository.delete(id, actorUserId);
  }

  async count(filters = {}) {
    return productRepository.count(filters);
  }
}

module.exports = new ProductService();

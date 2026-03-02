/**
 * Compatibility adapter for ProductRepository
 * Routes to domain/catalog/repositories
 */

const domain = require("../../domain");
const domainProductRepo = domain.catalog.repositories.ProductRpository;
const domainCategoryRepo = domain.catalog.repositories.CategoryRepository;

class ProductRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async listProducts(options = {}) {
    return domainProductRepo.findAll(options);
  }

  async getCategories() {
    return domainCategoryRepo.findAll();
  }

  async getFeaturedProducts(limit) {
    return domainProductRepo.findFeatured(limit);
  }

  async getProductById(productId) {
    return domainProductRepo.findById(productId);
  }

  async categoryExists(categoryId) {
    if (categoryId === null || categoryId === undefined) return true;
    return domainCategoryRepo.exists(categoryId);
  }

  async createProduct(data) {
    return domainProductRepo.create(data);
  }

  async replaceProduct(productId, data) {
    return domainProductRepo.update(productId, data);
  }

  async patchProduct(productId, data) {
    return domainProductRepo.update(productId, data);
  }

  async deleteProduct(productId, actorUserId, hardDelete = false) {
    return domainProductRepo.delete(productId, actorUserId);
  }

  async findAllWithCategory(filters = {}, options = {}) {
    return domainProductRepo.findAll(options);
  }

  async findByIdWithVariants(productId) {
    return domainProductRepo.findByIdWithVariants(productId);
  }
}

module.exports = ProductRepository;


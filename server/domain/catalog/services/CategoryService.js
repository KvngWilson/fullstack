const categoryRepository = require("../repositories/CategoryRepository");

/**
 * Category Service.
 * Handles category CRUD operations through the repository layer.
 */
class CategoryService {
  async getById(id) {
    return categoryRepository.findById(id);
  }

  async getAll() {
    return categoryRepository.findAll();
  }

  async create(categoryData) {
    return categoryRepository.create(categoryData);
  }

  async update(id, categoryData) {
    return categoryRepository.update(id, categoryData);
  }

  async delete(id) {
    return categoryRepository.delete(id);
  }

  async exists(id) {
    return categoryRepository.exists(id);
  }
}

module.exports = new CategoryService();

const categoryRepository = require("../repositories/CategoryRepository");
const BaseService = require("../../base/BaseService");
const catalogPolicy = require("../../../policies/catalogPolicy");

/**
 * Category Service.
 * Handles category CRUD operations through the repository layer.
 */
class CategoryService extends BaseService {
  constructor() {
    super();
  }

  async getById(id) {
    return categoryRepository.findById(id);
  }

  async getAll() {
    return categoryRepository.findAll();
  }

  async create(categoryData, employeeId = null) {
    if (employeeId) {
      await this.validatePermission(employeeId, catalogPolicy.category.create);
    }

    const category = await categoryRepository.create(categoryData);

    if (employeeId) {
      await this.auditLog(employeeId, "category:create", "category", category.id, {
        name: categoryData?.name,
      });
    }

    return category;
  }

  async update(id, categoryData, employeeId = null) {
    if (employeeId) {
      await this.validatePermission(employeeId, catalogPolicy.category.update);
    }

    const category = await categoryRepository.update(id, categoryData);

    if (employeeId && category) {
      await this.auditLog(employeeId, "category:update", "category", id, {
        changes: categoryData,
      });
    }

    return category;
  }

  async delete(id, employeeId = null) {
    if (employeeId) {
      await this.validatePermission(employeeId, catalogPolicy.category.delete);
    }

    const deleted = await categoryRepository.delete(id);

    if (employeeId && deleted) {
      await this.auditLog(employeeId, "category:delete", "category", id, {
        deleted: true,
      });
    }

    return deleted;
  }

  async exists(id) {
    return categoryRepository.exists(id);
  }
}

module.exports = new CategoryService();

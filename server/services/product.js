const { productRepository } = require("../data/repositories");
const cacheService = require("../infrastructure/cache/cacheService");

class ProductService {
  /**
   * Get product by ID (with caching)
   */
  async getProduct(productId) {
    const cacheKey = cacheService.keys.product(productId);

    return await cacheService.getOrSet(
      cacheKey,
      async () => {
        return await productRepository.findByIdWithVariants(productId);
      },
      600, // 10 minutes
    );
  }

  /**
   * Get products (with caching)
   */
  async getProducts(options) {
    const { page = 1, categoryId } = options;
    const cacheKey = cacheService.keys.productList(page, categoryId);

    return await cacheService.getOrSet(
      cacheKey,
      async () => {
        return await productRepository.findAllWithCategory({}, options);
      },
      300, // 5 minutes
    );
  }

  /**
   * Update product (invalidate cache)
   */
  async updateProduct(productId, data) {
    const product = await productRepository.update(productId, data);

    if (product) {
      // Invalidate caches
      await cacheService.del(cacheService.keys.product(productId));
      await cacheService.delPattern("products:page:*");
    }

    return product;
  }
}

module.exports = new ProductService();
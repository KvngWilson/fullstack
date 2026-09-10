const { successResponse, errorResponse } = require("../../../../shared/utils/response");
const { addProductLinks, wrapCollection } = require("../../../../shared/utils/hateoas");
const logger = require("../../../../shared/utils/logger");
const { validateBody } = require("../../../middleware/validation");
const { validateCreateProduct, validateUpdateProduct } = require("../../../validators/catalog");

// Domain services
const domain = require("../../../../domain");
const productService = domain.catalog.services.ProductService;
const categoryService = domain.catalog.services.CategoryService;

const PRODUCT_MUTABLE_FIELDS = [
  "name",
  "slug",
  "description",
  "category_id",
  "vendor_id",
  "image_url",
  "base_price",
  "is_active",
  "brand",
  "material",
  "care_instructions",
  "sku",
  "stock",
];

const getUploadedImageUrl = (req) => {
  if (!req?.file?.filename) {
    return null;
  }

  return `/uploads/products/${req.file.filename}`;
};

const toNumberOrNull = (value) => {
  // Convert string to number or return null
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? NaN : parsed;
};

const parseProductId = (rawId) => {
  // Validate and parse product ID from URL parameter
  const productId = Number.parseInt(rawId, 10);
  return Number.isInteger(productId) && productId > 0 ? productId : null;
};

// Ensure numeric price in serialized response
const normalizeProductOutput = (product) => ({
  ...product,
  base_price:
    product && product.base_price !== undefined && product.base_price !== null
      ? Number(product.base_price)
      : null,
  min_price:
    product && product.min_price !== undefined && product.min_price !== null
      ? Number(product.min_price)
      : null,
  max_price:
    product && product.max_price !== undefined && product.max_price !== null
      ? Number(product.max_price)
      : null,
});

exports.getAllProducts = async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 20,
      sort = "id",
      order = "asc",
      category,
      search,
    } = req.query;
    const result = await productService.getAll({
      page,
      pageSize,
      sort,
      order,
      category,
      search,
    });

    // Add HATEOAS links to collection response
    const collectionResponse = wrapCollection(
      result.products.map(normalizeProductOutput),
      {
        page: result.pagination.page,
        limit: result.pagination.pageSize,
        totalItems: result.pagination.total,
        baseUrl: '/api/v1/catalog/products',
        filters: { category, sort, order, search }
      },
      addProductLinks,
      req.user
    );

    return res.status(200).json({
      data: collectionResponse.data,
      pagination: result.pagination,
      _links: collectionResponse._links
    });
  } catch (error) {
    if (error.message && error.message.includes("Invalid sort")) {
      return errorResponse(res, { message: error.message, status: 400 });
    }
    logger.error("Get products error", { error });
    return errorResponse(res, { message: "Failed to fetch products", status: 500 });
  }
};

exports.listProducts = exports.getAllProducts;

exports.getProductCategories = async (_req, res) => {
  try {
    const categories = await categoryService.getAll();
    return successResponse(res, { data: categories });
  } catch (error) {
    logger.error("Get product categories error", { error });
    return errorResponse(res, { message: "Failed to fetch categories", status: 500 });
  }
};

exports.getFeaturedProducts = async (req, res) => {
  try {
    const limitRaw = Number.parseInt(req.query.limit, 10);
    const limit = Number.isInteger(limitRaw) && limitRaw > 0
      ? Math.min(limitRaw, 50)
      : 8;

    const products = await productService.getFeatured(limit);
    
    // Add HATEOAS links to each featured product
    const productsWithLinks = products
      .map(normalizeProductOutput)
      .map(product => addProductLinks(product, req.user));
    
    return successResponse(res, { data: productsWithLinks });
  } catch (error) {
    logger.error("Get featured products error", { error });
    return errorResponse(res, { message: "Failed to fetch featured products", status: 500 });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const productId = parseProductId(req.params.productId);
    if (!productId) {
      return errorResponse(res, { message: "Invalid product ID", status: 400 });
    }

    const product = await productService.getByIdWithVariants(productId);

    if (!product) {
      return errorResponse(res, { message: "Product not found", status: 404 });
    }

    // Add HATEOAS links to product response
    const productWithLinks = addProductLinks(normalizeProductOutput(product), req.user);

    return res.status(200).json(productWithLinks);
  } catch (error) {
    logger.error("Get product by ID error", { error, productId: req.params.productId });
    return errorResponse(res, { message: "Failed to fetch product", status: 500 });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const actorUserId = req.user?.id || null;
    const uploadedImageUrl = getUploadedImageUrl(req);
    
    const { error, value } = validateCreateProduct(req.body);
    if (error) {
      return errorResponse(res, { message: error.details[0].message, status: 400 });
    }

    const product = await productService.create({
      ...value,
      ...(uploadedImageUrl ? { image_url: uploadedImageUrl } : {}),
      actorUserId,
    });

    return res.status(201).json(normalizeProductOutput(product));
  } catch (error) {
    if (error.message === "Invalid category_id") {
      return errorResponse(res, { message: "Invalid category_id", status: 400 });
    }
    if (error.message === "vendor_id is required") {
      return errorResponse(res, { message: "Vendor is required", status: 400 });
    }
    logger.error("Create product error", { error, userId: req.user?.id });
    return errorResponse(res, { message: "Failed to create product", status: 500 });
  }
};

exports.replaceProduct = async (req, res) => {
  try {
    const actorUserId = req.user?.id || null;
    const uploadedImageUrl = getUploadedImageUrl(req);
    const productId = parseProductId(req.params.productId);
    if (!productId) {
      return errorResponse(res, { message: "Invalid product ID", status: 400 });
    }

    const { error, value } = validateCreateProduct(req.body);
    if (error) {
      return errorResponse(res, { message: error.details[0].message, status: 400 });
    }

    const product = await productService.update(productId, {
      ...value,
      ...(uploadedImageUrl ? { image_url: uploadedImageUrl } : {}),
      actorUserId,
    });

    if (!product) {
      return errorResponse(res, { message: "Product not found", status: 404 });
    }

    return res.status(200).json(normalizeProductOutput(product));
  } catch (error) {
    if (error.message === "Invalid category_id") {
      return errorResponse(res, { message: "Invalid category_id", status: 400 });
    }
    if (error.message === "vendor_id is required") {
      return errorResponse(res, { message: "Vendor is required", status: 400 });
    }
    logger.error("Replace product error", { error, productId: req.params.productId, userId: req.user?.id });
    return errorResponse(res, { message: "Failed to replace product", status: 500 });
  }
};

exports.updateProductPartial = async (req, res) => {
  try {
    const actorUserId = req.user?.id || null;
    const uploadedImageUrl = getUploadedImageUrl(req);
    const productId = parseProductId(req.params.productId);
    if (!productId) {
      return errorResponse(res, { message: "Invalid product ID", status: 400 });
    }

    const payload = Object.fromEntries(
      Object.entries(req.body || {}).filter(([key]) => PRODUCT_MUTABLE_FIELDS.includes(key)),
    );

    const { error, value } = validateUpdateProduct(payload);
    if (error) {
      return errorResponse(res, { message: error.details[0].message, status: 400 });
    }

    if (Object.keys(value).length === 0) {
      return errorResponse(res, { message: "No valid fields provided for update", status: 400 });
    }

    const product = await productService.update(productId, {
      ...value,
      ...(uploadedImageUrl ? { image_url: uploadedImageUrl } : {}),
      actorUserId,
    });

    if (!product) {
      return errorResponse(res, { message: "Product not found", status: 404 });
    }

    return res.status(200).json(normalizeProductOutput(product));
  } catch (error) {
    if (error.message === "Invalid category_id") {
      return errorResponse(res, { message: "Invalid category_id", status: 400 });
    }
    if (error.message === "vendor_id is required") {
      return errorResponse(res, { message: "Vendor is required", status: 400 });
    }
    logger.error("Patch product error", { error, productId: req.params.productId, userId: req.user?.id });
    return errorResponse(res, { message: "Failed to update product", status: 500 });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const actorUserId = req.user?.id || null;
    const productId = parseProductId(req.params.productId);
    if (!productId) {
      return errorResponse(res, { message: "Invalid product ID", status: 400 });
    }

    const deleted = await productService.delete(productId, actorUserId);

    if (!deleted) {
      return errorResponse(res, { message: "Product not found", status: 404 });
    }

    return res.status(204).send();
  } catch (error) {
    logger.error("Delete product error", { error, productId: req.params.productId, userId: req.user?.id });
    return errorResponse(res, { message: "Failed to delete product", status: 500 });
  }
};

const { pool } = require('../../config/db');
const { AppError } = require('../../utils/errors');

/**
 * Get user's wishlist
 */
const getWishlist = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT 
        w.id as wishlist_id,
        w.created_at as added_at,
        p.id as product_id,
        p.name,
        p.slug,
        p.description,
        p.image_url,
        p.base_price,
        v.store_name as vendor_name,
        c.name as category_name,
        (SELECT json_agg(
          json_build_object(
            'id', pv.id,
            'sku', pv.sku,
            'price', pv.price,
            'stock', pv.stock
          )
        ) FROM product_variants pv WHERE pv.product_id = p.id) as variants
      FROM wishlists w
      JOIN products p ON w.product_id = p.id
      LEFT JOIN vendors v ON p.vendor_id = v.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE w.user_id = $1
      ORDER BY w.created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rowCount,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add product to wishlist
 */
const addToWishlist = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { product_id } = req.body;

    if (!product_id) {
      throw new AppError('Product ID is required', 400);
    }

    // Check if product exists
    const productCheck = await pool.query(
      'SELECT id FROM products WHERE id = $1 AND deleted_at IS NULL',
      [product_id]
    );

    if (productCheck.rowCount === 0) {
      throw new AppError('Product not found', 404);
    }

    // Add to wishlist (or do nothing if already exists due to UNIQUE constraint)
    const result = await pool.query(
      `INSERT INTO wishlists (user_id, product_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, product_id) DO NOTHING
       RETURNING id, product_id, created_at`,
      [userId, product_id]
    );

    if (result.rowCount === 0) {
      // Already in wishlist
      return res.json({
        success: true,
        message: 'Product already in wishlist',
        alreadyExists: true,
      });
    }

    res.status(201).json({
      success: true,
      message: 'Product added to wishlist',
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove product from wishlist
 */
const removeFromWishlist = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { product_id } = req.params;

    if (!product_id) {
      throw new AppError('Product ID is required', 400);
    }

    const result = await pool.query(
      'DELETE FROM wishlists WHERE user_id = $1 AND product_id = $2 RETURNING id',
      [userId, product_id]
    );

    if (result.rowCount === 0) {
      throw new AppError('Product not found in wishlist', 404);
    }

    res.json({
      success: true,
      message: 'Product removed from wishlist',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Check if product is in wishlist
 */
const isInWishlist = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { product_id } = req.params;

    const result = await pool.query(
      'SELECT id FROM wishlists WHERE user_id = $1 AND product_id = $2',
      [userId, product_id]
    );

    res.json({
      success: true,
      isInWishlist: result.rowCount > 0,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Clear wishlist
 */
const clearWishlist = async (req, res, next) => {
  try {
    const userId = req.user.id;

    await pool.query('DELETE FROM wishlists WHERE user_id = $1', [userId]);

    res.json({
      success: true,
      message: 'Wishlist cleared',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  isInWishlist,
  clearWishlist,
};

// Cart controller: handles cart read/write operations (add, update, remove items, checkout)
const domain = require("../../../../domain");
const CartService = domain.ordering.services.CartService;
const { successResponse, errorResponse } = require("../../../../shared/utils/response");
const logger = require("../../../../shared/utils/logger");
const { addCartLinks } = require("../../../../shared/utils/hateoas");
const cartService = new CartService();

exports.getCartItems = async (req, res) => {
  try {
    const payload = await cartService.getCartSnapshot(req.user.id);
    
    // Add HATEOAS links to cart response
    const cartWithLinks = addCartLinks(payload);
    
    return successResponse(res, { data: cartWithLinks });
  } catch (error) {
    logger.error("Get cart error", { error, userId: req.user.id });
    return errorResponse(res, { message: "Failed to fetch cart", status: 500 });
  }
};

exports.getCartCount = async (req, res) => {
  try {
    const cartCount = await cartService.getCartCount(req.user.id);

    return successResponse(res, {
      data: cartCount,
    });
  } catch (error) {
    logger.error("Get cart count error", { error, userId: req.user.id });
    return errorResponse(res, { message: "Failed to fetch cart count", status: 500 });
  }
};

exports.addToCart = async (req, res) => {
  try {
    const result = await cartService.addToCart(req.user.id, req.body);

    return successResponse(res, {
      status: 201,
      message: "Item added to cart",
      data: result,
    });
  } catch (error) {
    logger.error("Add to cart error", { error, userId: req.user.id });
    return errorResponse(res, {
      message: error.message || "Failed to add item to cart",
      status: error.status || 500,
    });
  }
};

exports.updateCartItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const result = await cartService.updateCartItem(req.user.id, itemId, req.body.quantity);

    return successResponse(res, {
      message: "Cart item updated successfully",
      data: result,
    });
  } catch (error) {
    logger.error("Update cart item error", { error, userId: req.user.id });
    return errorResponse(res, {
      message: error.message || "Failed to update cart item",
      status: error.status || 500,
    });
  }
};

exports.deleteCartItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    await cartService.deleteCartItem(req.user.id, itemId);

    return successResponse(res, {
      message: "Cart item removed successfully",
      data: null,
    });
  } catch (error) {
    logger.error("Remove cart item error", { error, userId: req.user.id });
    return errorResponse(res, {
      message: error.message || "Failed to remove cart item",
      status: error.status || 500,
    });
  }
};

exports.clearCart = async (req, res) => {
  try {
    const cart = await cartService.clearCart(req.user.id);

    return successResponse(res, {
      message: "Cart cleared successfully",
      data: cart,
    });
  } catch (error) {
    logger.error("Clear cart error", { error, userId: req.user.id });
    return errorResponse(res, { message: "Failed to clear cart", status: 500 });
  }
};

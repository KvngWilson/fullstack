/**
 * HATEOAS (Hypermedia as the Engine of Application State) utilities
 * Adds navigation links to API responses for better discoverability
 */

const BASE_URL = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;

/**
 * Generate a HATEOAS link object
 * @param {string} rel - Relationship type (self, edit, delete, etc.)
 * @param {string} href - URL path
 * @param {string} method - HTTP method (GET, POST, PATCH, DELETE, etc.)
 * @returns {object} Link object
 */
function createLink(rel, href, method = 'GET') {
  return {
    rel,
    href: `${BASE_URL}${href}`,
    method
  };
}

/**
 * Add HATEOAS links to order resource
 * @param {object} order - Order object
 * @param {object} user - Current user context
 * @returns {object} Order with _links property
 */
function addOrderLinks(order, user) {
  const links = [
    createLink('self', `/api/v1/ordering/orders/${order.id}`, 'GET'),
  ];

  // Conditional links based on order status and permissions
  if (order.status === 'pending' || order.status === 'confirmed') {
    links.push(createLink('cancel', `/api/v1/ordering/orders/${order.id}`, 'DELETE'));
  }

  if (user?.role === 'admin' || user?.role === 'vendor') {
    links.push(createLink('update-status', `/api/v1/ordering/orders/${order.id}/status`, 'PATCH'));
  }

  // Navigation links
  links.push(createLink('customer', `/api/v1/identity/users/${order.user_id}`, 'GET'));
  links.push(createLink('payment', `/api/v1/payments?order_id=${order.id}`, 'GET'));

  return {
    ...order,
    _links: links
  };
}

/**
 * Add HATEOAS links to user/profile resource
 * @param {object} user - User object
 * @returns {object} User with _links property
 */
function addUserLinks(user) {
  const links = [
    createLink('self', `/api/v1/identity/users/${user.id}`, 'GET'),
    createLink('profile', `/api/v1/identity/profile`, 'GET'),
    createLink('update', `/api/v1/identity/profile`, 'PATCH'),
    createLink('delete', `/api/v1/identity/profile`, 'DELETE'),
    createLink('addresses', `/api/v1/identity/profile/addresses`, 'GET'),
    createLink('orders', `/api/v1/ordering/orders?user_id=${user.id}`, 'GET'),
    createLink('wishlist', `/api/v1/catalog/wishlist`, 'GET'),
  ];

  return {
    ...user,
    _links: links
  };
}

/**
 * Add HATEOAS links to product resource
 * @param {object} product - Product object
 * @param {object} user - Current user context
 * @returns {object} Product with _links property
 */
function addProductLinks(product, user) {
  const links = [
    createLink('self', `/api/v1/catalog/products/${product.id}`, 'GET'),
    createLink('add-to-cart', `/api/v1/ordering/cart`, 'POST'),
    createLink('add-to-wishlist', `/api/v1/catalog/wishlist`, 'POST'),
  ];

  if (user?.role === 'admin' || user?.role === 'vendor') {
    links.push(createLink('update', `/api/v1/catalog/products/${product.id}`, 'PATCH'));
    links.push(createLink('delete', `/api/v1/catalog/products/${product.id}`, 'DELETE'));
  }

  return {
    ...product,
    _links: links
  };
}

/**
 * Add HATEOAS links to cart resource
 * @param {object} cart - Cart object
 * @returns {object} Cart with _links property
 */
function addCartLinks(cart) {
  const links = [
    createLink('self', `/api/v1/ordering/cart`, 'GET'),
    createLink('checkout', `/api/v1/ordering/orders`, 'POST'),
    createLink('clear', `/api/v1/ordering/cart`, 'DELETE'),
  ];

  return {
    ...cart,
    _links: links
  };
}

/**
 * Add pagination links to collection response
 * @param {string} baseUrl - Base URL for the resource
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {number} totalItems - Total number of items
 * @param {object} filters - Additional query parameters
 * @returns {object} Pagination links
 */
function addPaginationLinks(baseUrl, page, limit, totalItems, filters = {}) {
  const totalPages = Math.ceil(totalItems / limit);
  const queryString = new URLSearchParams(filters).toString();
  const separator = queryString ? '&' : '';

  const links = [
    createLink('self', `${baseUrl}?page=${page}&limit=${limit}${separator}${queryString}`, 'GET'),
  ];

  if (page > 1) {
    links.push(createLink('first', `${baseUrl}?page=1&limit=${limit}${separator}${queryString}`, 'GET'));
    links.push(createLink('prev', `${baseUrl}?page=${page - 1}&limit=${limit}${separator}${queryString}`, 'GET'));
  }

  if (page < totalPages) {
    links.push(createLink('next', `${baseUrl}?page=${page + 1}&limit=${limit}${separator}${queryString}`, 'GET'));
    links.push(createLink('last', `${baseUrl}?page=${totalPages}&limit=${limit}${separator}${queryString}`, 'GET'));
  }

  return links;
}

/**
 * Wrap collection response with metadata and HATEOAS links
 * @param {array} items - Collection items
 * @param {object} options - Options including page, limit, totalItems, baseUrl, filters
 * @param {function} linkGenerator - Function to add links to each item
 * @param {object} user - Current user context
 * @returns {object} Collection response with metadata
 */
function wrapCollection(items, options, linkGenerator, user) {
  const { page = 1, limit = 20, totalItems, baseUrl, filters = {} } = options;

  return {
    data: items.map(item => linkGenerator ? linkGenerator(item, user) : item),
    meta: {
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      hasNext: page < Math.ceil(totalItems / limit),
      hasPrev: page > 1
    },
    _links: addPaginationLinks(baseUrl, page, limit, totalItems, filters)
  };
}

module.exports = {
  createLink,
  addOrderLinks,
  addUserLinks,
  addProductLinks,
  addCartLinks,
  addPaginationLinks,
  wrapCollection
};

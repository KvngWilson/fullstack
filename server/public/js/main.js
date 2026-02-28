// Cart Management
document.addEventListener('DOMContentLoaded', function() {
  // Quantity Selector on Product Detail
  const qtyPlus = document.getElementById('qty-plus');
  const qtyMinus = document.getElementById('qty-minus');
  const qtyInput = document.getElementById('quantity');

  if (qtyPlus && qtyMinus && qtyInput) {
    qtyPlus.addEventListener('click', function() {
      qtyInput.value = parseInt(qtyInput.value) + 1;
    });

    qtyMinus.addEventListener('click', function() {
      if (parseInt(qtyInput.value) > 1) {
        qtyInput.value = parseInt(qtyInput.value) - 1;
      }
    });
  }

  // Add to Cart
  const addToCartBtn = document.getElementById('add-to-cart');
  if (addToCartBtn) {
    addToCartBtn.addEventListener('click', function() {
      const productId = new URLSearchParams(window.location.search).get('id') || 
                        window.location.pathname.split('/').pop();
      const quantity = parseInt(document.getElementById('quantity').value);
      
      if (productId) {
        addToCart(productId, quantity);
      }
    });
  }

  // Quick Add Buttons
  document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      const productId = this.dataset.productId;
      addToCart(productId, 1);
    });
  });

  // Remove from Cart
  document.querySelectorAll('.remove-from-cart').forEach(btn => {
    btn.addEventListener('click', function() {
      const itemId = this.dataset.itemId;
      removeFromCart(itemId);
    });
  });

  // Update Cart Quantity
  document.querySelectorAll('.cart-quantity').forEach(input => {
    input.addEventListener('change', function() {
      const itemId = this.dataset.itemId;
      const quantity = parseInt(this.value);
      updateCartQuantity(itemId, quantity);
    });
  });

  // Add to Wishlist
  const addToWishlist = document.getElementById('add-to-wishlist');
  if (addToWishlist) {
    addToWishlist.addEventListener('click', function() {
      const productId = new URLSearchParams(window.location.search).get('id') || 
                        window.location.pathname.split('/').pop();
      if (productId) {
        toggleWishlist(productId);
      }
    });
  }
});

// API Functions
async function addToCart(productId, quantity = 1) {
  try {
    const response = await fetch('/api/v1/cart', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productId: productId,
        quantity: quantity
      })
    });

    if (response.ok) {
      showNotification('Added to cart!', 'success');
      updateCartCount();
    } else {
      showNotification('Failed to add to cart', 'error');
    }
  } catch (error) {
    console.error('Error adding to cart:', error);
    showNotification('Error adding to cart', 'error');
  }
}

async function removeFromCart(itemId) {
  try {
    const response = await fetch(`/api/v1/cart/${itemId}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      showNotification('Removed from cart', 'success');
      location.reload();
    } else {
      showNotification('Failed to remove item', 'error');
    }
  } catch (error) {
    console.error('Error removing from cart:', error);
    showNotification('Error removing item', 'error');
  }
}

async function updateCartQuantity(itemId, quantity) {
  try {
    const response = await fetch(`/api/v1/cart/${itemId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ quantity: quantity })
    });

    if (response.ok) {
      location.reload();
    } else {
      showNotification('Failed to update quantity', 'error');
    }
  } catch (error) {
    console.error('Error updating cart:', error);
  }
}

async function toggleWishlist(productId) {
  try {
    const response = await fetch('/api/v1/wishlist', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ productId: productId })
    });

    if (response.ok) {
      showNotification('Added to wishlist!', 'success');
    } else {
      showNotification('Failed to add to wishlist', 'error');
    }
  } catch (error) {
    console.error('Error toggling wishlist:', error);
  }
}

async function updateCartCount() {
  try {
    const response = await fetch('/api/v1/cart/count');
    if (response.ok) {
      const data = await response.json();
      document.querySelector('.cart-count').textContent = data.count || 0;
    }
  } catch (error) {
    console.error('Error updating cart count:', error);
  }
}

// Notification System
function showNotification(message, type = 'info') {
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
  alertDiv.role = 'alert';
  alertDiv.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;

  const container = document.querySelector('body');
  const tempDiv = document.createElement('div');
  tempDiv.className = 'position-fixed top-0 start-50 translate-middle-x mt-3';
  tempDiv.style.zIndex = '9999';
  tempDiv.appendChild(alertDiv);
  container.appendChild(tempDiv);

  setTimeout(() => {
    tempDiv.remove();
  }, 4000);
}

// Hover Effect for Product Cards
document.querySelectorAll('.product-card').forEach(card => {
  card.addEventListener('mouseenter', function() {
    this.style.transform = 'translateY(-5px)';
  });
  card.addEventListener('mouseleave', function() {
    this.style.transform = 'translateY(0)';
  });
});

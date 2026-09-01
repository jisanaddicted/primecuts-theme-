/**
 * Cart Auto Update via AJAX
 * Automatically updates cart when quantity changes without requiring manual button click
 */

class CartAutoUpdate {
  constructor() {
    this.updateTimeout = null;
    this.isUpdating = false;
    this.init();
  }

  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupListeners());
    } else {
      this.setupListeners();
    }
  }

  setupListeners() {
    // Get all quantity input fields
    const qtyInputs = document.querySelectorAll('.cart-qty');
    
    qtyInputs.forEach((input) => {
      // Trigger on input change
      input.addEventListener('change', (e) => this.handleQuantityChange(e));
      
      // Also trigger on keyup for real-time feedback
      input.addEventListener('keyup', (e) => this.handleQuantityChange(e));
    });
  }

  handleQuantityChange(event) {
    const input = event.target;
    
    // Clear previous timeout to debounce updates
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }

    // Debounce the update request (wait 2500ms after user stops typing)
    // Increased to give user enough time to enter full quantity comfortably
    this.updateTimeout = setTimeout(() => {
      this.updateCart(input);
    }, 2500);
  }

  updateCart(input) {
    if (this.isUpdating) return;

    const quantity = parseInt(input.value) || 0;
    const itemKey = input.id.replace('updates_', '');

    // Validate quantity
    if (quantity < 0) {
      input.value = 0;
      return;
    }

    // Special handling for 0 quantity: remove the item instead of updating
    if (quantity === 0) {
      this.removeCartItem(input, itemKey);
      return;
    }

    this.isUpdating = true;
    this.showLoadingState(input);

    // Build the cart update data
    const updateData = {
      updates: {
        [itemKey]: quantity
      }
    };

    // Make AJAX request to update cart
    fetch(`${window.Shopify.routes.root}cart/update.js`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify(updateData)
    })
    .then((response) => {
      if (!response.ok) {
        throw new Error('Cart update failed');
      }
      return response.json();
    })
    .then((data) => {
      this.isUpdating = false;
      this.hideLoadingState(input);
      
      // Update the cart display
      this.updateCartDisplay(data);
      
      // Trigger custom event for other scripts (like cart progress bar)
      document.dispatchEvent(new CustomEvent('cart:updated', { detail: data }));
      
      this.showSuccessMessage(input);
    })
    .catch((error) => {
      this.isUpdating = false;
      this.hideLoadingState(input);
      console.error('Cart update error:', error);
      this.showErrorMessage(input);
    });
  }

  removeCartItem(input, itemKey) {
    this.isUpdating = true;
    this.showLoadingState(input);

    // Store the cart item row for removal
    const cartItemRow = input.closest('.cart-item');

    // Build the cart update data with quantity 0 to remove
    const updateData = {
      updates: {
        [itemKey]: 0
      }
    };

    // Make AJAX request to remove item from cart
    fetch(`${window.Shopify.routes.root}cart/update.js`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify(updateData)
    })
    .then((response) => {
      if (!response.ok) {
        throw new Error('Cart remove failed');
      }
      return response.json();
    })
    .then((data) => {
      this.isUpdating = false;
      this.hideLoadingState(input);
      
      // Update the cart display
      this.updateCartDisplay(data);
      
      // Trigger custom event for other scripts (like cart progress bar)
      document.dispatchEvent(new CustomEvent('cart:updated', { detail: data }));
      
      // Remove the cart item row from DOM
      if (cartItemRow) {
        cartItemRow.style.opacity = '0.5';
        setTimeout(() => {
          cartItemRow.remove();
        }, 500);
      }

      // Show removal message instead of generic success
      const message = document.createElement('span');
      message.className = 'cart-update-message success';
      message.textContent = 'Item removed';
      if (input.parentElement) {
        input.parentElement.appendChild(message);
      }

      setTimeout(() => {
        message.classList.add('fade-out');
        setTimeout(() => message.remove(), 300);
      }, 2000);
    })
    .catch((error) => {
      this.isUpdating = false;
      this.hideLoadingState(input);
      console.error('Cart remove error:', error);
      this.showErrorMessage(input);
      // Reset input value to 1 instead of reloading page
      input.value = 1;
    });
  }

  updateCartDisplay(cartData) {
    // Update each cart item's total price
    cartData.items.forEach((item, index) => {
      const cartItem = document.querySelectorAll('.cart-item')[index];
      if (cartItem) {
        const totalCell = cartItem.querySelector('.cart-item__total');
        if (totalCell && item.final_line_price !== undefined) {
          totalCell.textContent = this.formatMoney(item.final_line_price);
        }
      }
    });

    // Update cart summary (subtotal)
    const subtotalElement = document.querySelector('.cart-summary__row strong');
    if (subtotalElement && cartData.total_price !== undefined) {
      subtotalElement.textContent = this.formatMoney(cartData.total_price);
    }

    // Update item count if displayed
    const itemCountElements = document.querySelectorAll('[data-cart-item-count]');
    if (itemCountElements.length > 0 && cartData.item_count !== undefined) {
      itemCountElements.forEach((el) => {
        el.textContent = cartData.item_count;
      });
    }
  }

  showLoadingState(input) {
    input.classList.add('updating');
    input.disabled = true;
  }

  hideLoadingState(input) {
    input.classList.remove('updating');
    input.disabled = false;
  }

  showSuccessMessage(input) {
    const message = document.createElement('span');
    message.className = 'cart-update-message success';
    message.textContent = 'Updated';
    
    input.parentElement.appendChild(message);

    setTimeout(() => {
      message.classList.add('fade-out');
      setTimeout(() => message.remove(), 300);
    }, 2000);
  }

  showErrorMessage(input) {
    const message = document.createElement('span');
    message.className = 'cart-update-message error';
    message.textContent = 'Update failed';
    
    input.parentElement.appendChild(message);

    setTimeout(() => {
      message.classList.add('fade-out');
      setTimeout(() => message.remove(), 3000);
    }, 2500);
  }

  formatMoney(cents) {
    if (typeof Shopify !== 'undefined' && Shopify.formatMoney) {
      return Shopify.formatMoney(cents);
    }
    // Fallback formatting if Shopify method not available
    const dollars = (cents / 100).toFixed(2);
    return `$${dollars}`;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.cartAutoUpdate = new CartAutoUpdate();
  });
} else {
  window.cartAutoUpdate = new CartAutoUpdate();
}

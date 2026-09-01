function initDirectCheckoutForm() {
  const checkoutForm = document.querySelector('#direct-checkout-form');
  if (!checkoutForm) return;

  const variantField = checkoutForm.querySelector('[name="id"]');
  const quantityField = checkoutForm.querySelector('[name="quantity"]');
  const submitButton = checkoutForm.querySelector('button[type="submit"]');
  const buttonText = checkoutForm.querySelector('.text-block-17');

  // Store current locale to detect market changes
  const currentLocale = document.documentElement.lang;
  sessionStorage.setItem('lastLocale', currentLocale);

  const fetchProductData = async () => {
    try {
      const response = await fetch(window.location.pathname + '.json');
      if (response.ok) {
        const data = await response.json();
        return data.product;
      }
    } catch (error) {
      console.error('Error fetching product data:', error);
    }
    return null;
  };

  // Find first available variant in current market
  const getFirstAvailableVariant = async () => {
    const product = await fetchProductData();
    if (product && product.variants) {
      for (let variant of product.variants) {
        if (variant.available) {
          return variant;
        }
      }
    }
    return null;
  };

  const getSelectedVariantAvailability = async () => {
    if (!variantField) return { isAvailable: true };

    // If it's a select dropdown, check the data-available attribute
    if (variantField.tagName && variantField.tagName.toLowerCase() === 'select') {
      const selectedOption = variantField.options[variantField.selectedIndex];
      const variantId = parseInt(selectedOption.value);
      
      // Fetch fresh data to get accurate availability for current market
      const product = await fetchProductData();
      if (product) {
        const variant = product.variants.find(v => v.id === variantId);
        if (variant) {
          return { isAvailable: variant.available };
        }
      }
      
      // Fallback to data attribute if fetch fails
      const isAvailable = selectedOption && selectedOption.dataset.available === 'true';
      return { isAvailable };
    }

    return { isAvailable: true };
  };

  const syncAvailabilityState = async () => {
    if (!submitButton) return;
    const { isAvailable } = await getSelectedVariantAvailability();
    
    if (!isAvailable) {
      submitButton.disabled = true;
      submitButton.style.opacity = "0.5";
      if (buttonText) buttonText.innerText = 'Sold Out';
    } else {
      submitButton.disabled = false;
      submitButton.style.opacity = "1";
      if (buttonText) buttonText.innerText = 'Jetzt Kaufen';
    }
  };

  const addToCartAndRedirect = async () => {
    // CRITICAL: Double-check availability right before checkout
    const { isAvailable } = await getSelectedVariantAvailability();
    if (!isAvailable) {
      alert('Sorry, this variant is no longer available in your market. Selecting the first available option.');
      // Auto-select first available and try again
      const firstAvailable = await getFirstAvailableVariant();
      if (firstAvailable && variantField) {
        variantField.value = firstAvailable.id;
        variantField.dispatchEvent(new Event('change'));
        syncAvailabilityState();
      } else {
        alert('Unfortunately, this product is currently out of stock in your market.');
        if (buttonText) buttonText.innerText = 'Sold Out';
        submitButton.disabled = true;
      }
      return;
    }

    // Verify selected variant ID is actually available
    const product = await fetchProductData();
    const variantId = parseInt(variantField.value);
    const selectedVariant = product?.variants?.find(v => v.id === variantId);
    
    if (!selectedVariant?.available) {
      console.error('Selected variant is not available:', variantId);
      alert('This variant is not available in your market. Selecting available option...');
      const firstAvailable = await getFirstAvailableVariant();
      if (firstAvailable && variantField) {
        variantField.value = firstAvailable.id;
        variantField.dispatchEvent(new Event('change'));
      }
      return;
    }

    // Change button state to "Loading"
    if (buttonText) buttonText.innerText = 'Processing...';
    submitButton.disabled = true;

    const quantity = quantityField ? quantityField.value : 1;

    const formData = {
      items: [{
        id: variantId,
        quantity: parseInt(quantity, 10),
      }],
    };

    console.log('Attempting to add to cart:', formData);

    fetch(window.Shopify.routes.root + 'cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })
    .then((response) => {
      if (response.ok) {
        console.log('Successfully added to cart, redirecting to checkout');
        window.location.href = '/checkout';
      } else {
        return response.json().then((err) => {
          console.error('Cart add error:', err);
          const errorMsg = err.description || err.message || 'Failed to add to cart';
          alert('Error: ' + errorMsg);
          
          // If error is "already sold out", force refresh and select available
          if (errorMsg.includes('sold out') || errorMsg.includes('Sold Out')) {
            console.log('Variant sold out, refreshing and selecting available...');
            const firstAvailable = await getFirstAvailableVariant();
            if (firstAvailable && variantField) {
              variantField.value = firstAvailable.id;
              variantField.dispatchEvent(new Event('change'));
            }
          }
          
          syncAvailabilityState(); // Reset button
        });
      }
    })
    .catch((error) => {
      console.error('Network Error:', error);
      alert('Network error. Please try again.');
      syncAvailabilityState(); 
    });
  };

  // Listen for variant changes to update button (Sold Out vs Buy Now)
  if (variantField) {
    variantField.addEventListener('change', syncAvailabilityState);
  }
  
  syncAvailabilityState(); // Run once on load

  // Detect market/locale changes and refresh availability
  const checkForMarketChange = async () => {
    const newLocale = document.documentElement.lang;
    const lastLocale = sessionStorage.getItem('lastLocale');
    
    if (lastLocale && newLocale !== lastLocale) {
      console.log('Market changed from', lastLocale, 'to', newLocale);
      sessionStorage.setItem('lastLocale', newLocale);
      
      // Auto-select first available variant for new market
      const firstAvailable = await getFirstAvailableVariant();
      if (firstAvailable && variantField) {
        console.log('Auto-selecting available variant:', firstAvailable.id);
        variantField.value = firstAvailable.id;
        variantField.dispatchEvent(new Event('change'));
      } else {
        console.warn('No available variants found in market:', newLocale);
      }
      
      // Refresh availability when market changes
      syncAvailabilityState();
    }
  };

  // Check for market changes more frequently
  setInterval(checkForMarketChange, 500);

  // Also listen for common Shopify events
  document.addEventListener('shopify:section:load', () => {
    console.log('Section load detected, checking market');
    checkForMarketChange();
  });
  document.addEventListener('shopify:section:unload', () => {
    console.log('Section unload detected, checking market');
    checkForMarketChange();
  });
  
  // Listen for visibility changes (when user returns to tab)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      checkForMarketChange();
    }
  });

  // Intercept the submit event
  checkoutForm.addEventListener('submit', function (e) {
    e.preventDefault();
    e.stopPropagation();
    addToCartAndRedirect();
  }, true);
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDirectCheckoutForm);
} else {
  initDirectCheckoutForm();
}

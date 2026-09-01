/**
 * Cart Progress Bar with Milestone Rewards
 * Tracks cart total and reveals rewards at milestones equivalent to $1000 and $2000 USD
 * Dynamically handles multi-currency selection.
 */

class CartProgressBar {
  constructor() {
    // Currency conversion rates relative to 1 USD
    this.currencyRates = {
      'USD': 1,
      'EUR': 0.92,
      'GBP': 0.80,
      'CAD': 1.36,
      'AUD': 1.53,
      'JPY': 149.50,
      'CHF': 0.88,
      'INR': 83.12,
      'MXN': 17.05,
      'BRL': 4.97,
      'CNY': 7.24,
      'SEK': 10.50,
      'NZD': 1.66,
      'ZAR': 18.50,
      'SGD': 1.35,
      'HKD': 7.81,
      'NOK': 10.60,
      'KRW': 1319.50,
      'TWD': 31.50,
      'TRY': 33.50,
      'BDT': 120
    };
    
    this.baseUSD = 2000; // Base milestone in USD
    this.currency = 'USD';
    this.currencySymbol = '$';
    this.cartTotal = 0;
    
    this.milestones = [
      {
        usdAmount: 1000,
        label: 'First Free Product',
        reward: 'Free Item',
        icon: ''
      },
      {
        usdAmount: 2000,
        label: 'Second Free Product',
        reward: 'Free Item',
        icon: ''
      } 
    ];
    
    this.unlockedMilestones = [];
    this.init();
  }

  init() {
    // Load dynamic currency data
    this.loadCurrencyData();
    
    // Wait for cart data to be available
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.render());
    } else {
      this.render();
    }

    // Update progress bar when cart updates globally
    document.addEventListener('cart:updated', () => this.render());
  }

  loadCurrencyData() {
    const container = document.querySelector('.cart-progress-container');
    if (!container) return;

    // 1. Detect currency from Shopify or container dataset
    const rawCurrency = window.Shopify?.currency?.active || container.dataset.currency || 'USD';
    this.currency = rawCurrency.toUpperCase();

    // 2. Get currency symbol
    this.currencySymbol = this.getFallbackSymbol(this.currency);
    
    // 3. Get cart total from the DOM
    this.cartTotal = this.getCartTotal();
  }

  getCartTotal() {
    // Get cart total from the cart summary
    const cartSummary = document.querySelector('.cart-summary__row strong');
    if (!cartSummary) return 0;

    const priceText = cartSummary.textContent || '';
    // Extract numeric value, remove currency symbols
    const total = parseFloat(priceText.replace(/[^\d.]/g, ''));
    return isNaN(total) ? 0 : total;
  }

  getFallbackSymbol(currencyCode) {
    const symbols = { 
      'USD': '$', 'EUR': '€', 'GBP': '£', 'CAD': '$', 
      'AUD': '$', 'BDT': '৳', 'INR': '₹', 'JPY': '¥',
      'CHF': 'CHF', 'CNY': '¥', 'SEK': 'kr', 'NZD': '$',
      'ZAR': 'R', 'SGD': '$', 'HKD': '$', 'NOK': 'kr',
      'KRW': '₩', 'TWD': '$', 'TRY': '₺', 'MXN': '$', 'BRL': 'R$'
    };
    return symbols[currencyCode] || currencyCode;
  }

  getConversionRate() {
    return this.currencyRates[this.currency] || 1;
  }

  getMilestoneAmountInLocalCurrency(usdAmount) {
    const rate = this.getConversionRate();
    return Math.round(usdAmount * rate * 100) / 100;
  }

  formatPrice(amount) {
    return this.currencySymbol + amount.toLocaleString(undefined, { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  }

  render() {
    const container = document.querySelector('.cart-progress-container');
    if (!container) return;

    // Refresh currency data on each render
    this.loadCurrencyData();

    const currentTotal = this.cartTotal;
    const maxMilestoneUSD = this.baseUSD;
    const maxMilestoneLocal = this.getMilestoneAmountInLocalCurrency(maxMilestoneUSD);
    const progressPercent = Math.min((currentTotal / maxMilestoneLocal) * 100, 100);

    // Update progress bar fill
    const progressFill = container.querySelector('.progress-bar__fill');
    if (progressFill) {
      progressFill.style.width = progressPercent + '%';
    }

    // Update amount display
    const amountDisplay = container.querySelector('.progress-header__amount');
    if (amountDisplay) {
      amountDisplay.innerHTML = `<strong>${this.formatPrice(currentTotal)}</strong> / ${this.formatPrice(maxMilestoneLocal)}`;
    }

    // Update milestone states
    this.updateMilestoneStates(container, currentTotal);

    // Show/hide reward products based on unlocked milestones
    this.updateRewardProducts(container, currentTotal);
  }

  updateMilestoneStates(container, currentTotal) {
    const milestoneElements = container.querySelectorAll('.milestone');

    milestoneElements.forEach((element, index) => {
      const milestone = this.milestones[index];
      const milestoneLocal = this.getMilestoneAmountInLocalCurrency(milestone.usdAmount);
      const isUnlocked = currentTotal >= milestoneLocal;
      const isActive = index === 0 ? 
        (currentTotal >= milestoneLocal && currentTotal < this.getMilestoneAmountInLocalCurrency(2000)) :
        (currentTotal >= milestoneLocal);

      element.classList.remove('active', 'unlocked');

      if (isUnlocked) {
        element.classList.add('unlocked');
        if (!this.unlockedMilestones.includes(index)) {
          this.playUnlockAnimation(element);
          this.unlockedMilestones.push(index);
        }
      } else if (isActive) {
        element.classList.add('active');
      }

      // Update milestone amount display
      const amountElement = element.querySelector('.milestone__amount');
      if (amountElement) {
        amountElement.textContent = `Unlock at ${this.formatPrice(milestoneLocal)}`;
      }

      const badge = element.querySelector('.milestone__badge');
      if (badge) {
        badge.textContent = isUnlocked ? 'Unlocked' : 'Locked';
      }
    });
  }

  updateRewardProducts(container, currentTotal) {
    const rewardsContainer = container.querySelector('.reward-products');
    if (!rewardsContainer) return;

    const rewardElements = rewardsContainer.querySelectorAll('.reward-product');
    rewardElements.forEach((element, index) => {
      if (index >= this.milestones.length) return;
      
      const milestoneUSD = this.milestones[index].usdAmount;
      const milestoneLocal = this.getMilestoneAmountInLocalCurrency(milestoneUSD);
      const shouldReveal = currentTotal >= milestoneLocal;

      element.classList.toggle('revealed', shouldReveal);

      // 80% proximity warning
      const firstMilestoneLocal = this.getMilestoneAmountInLocalCurrency(1000);
      const approachThreshold = firstMilestoneLocal * 0.8; 
      
      if (index === 0 && currentTotal >= approachThreshold && currentTotal < firstMilestoneLocal && !element.classList.contains('message-shown')) {
        const remaining = (firstMilestoneLocal - currentTotal).toFixed(2);
        this.showEncouragementMessage(container, 'next', `Just ${this.formatPrice(remaining)} more for a free product!`);
        element.classList.add('message-shown');
      }

      if (shouldReveal && !element.classList.contains('celebration-shown')) {
        this.showEncouragementMessage(container, 'unlocked', 'Add email while payment to get the redeem code for your free product.');
        element.classList.add('celebration-shown');
      }
    });
  }

  showEncouragementMessage(container, type, text) {
    const isUnlockedMessage = type === 'unlocked';
    const selector = isUnlockedMessage ? '.milestone-message.unlocked' : '.milestone-message.next';
    let message = container.querySelector(selector);

    if (!message) {
      message = document.createElement('div');
      message.className = `milestone-message ${type}`;

      const milestones = container.querySelector('.milestones');
      if (milestones) {
        milestones.insertAdjacentElement('afterend', message);
      }
    }

    message.innerHTML = `<strong>${text}</strong>`;
    message.style.opacity = '1';
    message.style.transition = '';

    if (!isUnlockedMessage) {
      setTimeout(() => {
        if (message.parentElement) {
          message.style.opacity = '0';
          message.style.transition = 'opacity 0.5s ease-out';
        }
      }, 5000);
    }
  }

  playUnlockAnimation(element) {
    element.style.animation = 'none';
    setTimeout(() => {
      element.style.animation = '';
    }, 10);
  }
}

// Global initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.cartProgressBar = new CartProgressBar();
  });
} else {
  window.cartProgressBar = new CartProgressBar();
}

// Re-render when form is submitted (update cart)
document.addEventListener('submit', (e) => {
  if (e.target.closest('form')?.action?.includes('cart')) {
    setTimeout(() => {
      if (window.cartProgressBar) {
        window.cartProgressBar.render();
      }
    }, 1000);
  }
});

// Listen for currency changes
document.addEventListener('change', (e) => {
  const target = e.target;
  const isCurrencySelector = target.matches('[name="currency"]') || 
                             target.matches('[name="country_code"]') || 
                             target.closest('.currency-selector');
                             
  if (isCurrencySelector) {
    setTimeout(() => {
      if (window.cartProgressBar) {
        window.cartProgressBar.render();
      }
    }, 400);
  }
});

// Listen for any cart update from Shopify
if (window.Shopify) {
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    return originalFetch.apply(window, args).then((response) => {
      if (args[0]?.includes?.('cart') || args[0]?.includes?.('/cart')) {
        setTimeout(() => {
          if (window.cartProgressBar) {
            window.cartProgressBar.render();
          }
        }, 300);
      }
      return response;
    });
  };
}

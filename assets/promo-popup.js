/**
 * PromoPopup — Logic for showing buy 3 get 40% discount popup.
 */
(function() {
  'use strict';

  const POPUP_ID = 'PromoPopup';
  const SHOW_DELAY = 10000; // 10 seconds
  const STORAGE_KEY = 'promo_popup_shown';

  class PromoPopup {
    constructor() {
      this.popup = document.getElementById(POPUP_ID);
      if (!this.popup) return;

      this.closeBtn = this.popup.querySelector('.promo-popup__close');
      this.overlay = this.popup.querySelector('.promo-popup__overlay');
      this.secondaryBtn = this.popup.querySelector('.promo-popup__secondary-btn');
      this.textEl = this.popup.querySelector('[data-promo-text]');
      
      this.init();
    }

    init() {
      // Close events
      [this.closeBtn, this.overlay, this.secondaryBtn].forEach(el => {
        if (el) el.addEventListener('click', () => this.hide());
      });

      // Show after delay
      setTimeout(() => {
        this.trigger('timer');
      }, SHOW_DELAY);

      // Listen for cart additions
      document.addEventListener('cart:add', () => {
        this.trigger('cart');
      });

      // Initial text update
      this.updateText();
    }

    async updateText() {
      if (!this.textEl) return;
      
      try {
        const response = await fetch('/cart.js');
        const cart = await response.json();
        
        // Count items (excluding engravings if necessary, but usually buy 3 means any 3)
        // Based on engraving-cart.js, they exclude variant 48572858400991
        const ENGRAVING_VARIANT_ID = 48572858400991;
        let count = 0;
        cart.items.forEach(item => {
          if (item.variant_id !== ENGRAVING_VARIANT_ID) {
            count += item.quantity;
          }
        });

        let text = '';
        if (count === 0) {
          text = 'Add 3 more products to avail 40% discount';
        } else if (count === 1) {
          text = 'Add 2 more products to avail 40% discount';
        } else if (count === 2) {
          text = 'Add only 1 more product to avail 40% discount!';
        } else {
          text = 'You have unlocked the 40% discount! Checkout now.';
        }

        this.textEl.textContent = text;
        return count;
      } catch (e) {
        console.error('Failed to update promo text', e);
      }
    }

    async trigger(source) {
      if (sessionStorage.getItem(STORAGE_KEY)) return;

      const count = await this.updateText();
      
      if (source === 'cart' && count === 1) {
        // First item added
        this.show();
      } else if (source === 'timer') {
        this.show();
      }
    }

    show() {
      if (this.popup.classList.contains('is-active')) return;
      
      this.popup.classList.add('is-active');
      this.popup.setAttribute('aria-hidden', 'false');
      sessionStorage.setItem(STORAGE_KEY, 'true');
    }

    hide() {
      this.popup.classList.remove('is-active');
      this.popup.setAttribute('aria-hidden', 'true');
    }
  }

  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    new PromoPopup();
  });
})();

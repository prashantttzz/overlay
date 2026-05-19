/**
 * PromoPopup — Logic for showing buy 3 get 40% discount popup.
 */
(function() {
  'use strict';

  const POPUP_ID = 'PromoPopup';
  const SHOW_DELAY = 5000; // 5 seconds
  const STORAGE_KEY = 'promo_popup_shown';


  class PromoPopup {
    constructor() {
      this.popup = document.getElementById(POPUP_ID);
      this.card = document.getElementById('CartPromoCard');
      this.successPopup = document.getElementById('DiscountSuccessPopup');
      
      this.closeBtn = this.popup?.querySelector('.promo-popup__close');
      this.overlay = this.popup?.querySelector('.promo-popup__overlay');
      this.secondaryBtn = this.popup?.querySelector('.promo-popup__secondary-btn');
      
      this.successCloseBtn = this.successPopup?.querySelector('.discount-success-popup__close');
      this.successOverlay = this.successPopup?.querySelector('.discount-success-popup__overlay');
      this.successSecondaryBtn = this.successPopup?.querySelector('.discount-success-popup__secondary');
      this.successMainBtn = this.successPopup?.querySelector('.discount-success-popup__btn');

      this.popupTextEl = this.popup?.querySelector('[data-promo-text]');
      this.cardTextEl = this.card?.querySelector('[data-cart-promo-text]');
      
      this.previousCount = null;
      this.init();
    }

    init() {
      // Close events for main promo popup
      if (this.popup) {
        [this.closeBtn, this.overlay, this.secondaryBtn].forEach(el => {
          if (el) el.addEventListener('click', () => this.hide());
        });

        // Show after delay
        setTimeout(() => {
          this.trigger('timer');
        }, SHOW_DELAY);
      }

      // Close events for success popup
      if (this.successPopup) {
        [this.successCloseBtn, this.successOverlay, this.successSecondaryBtn, this.successMainBtn].forEach(el => {
          if (el) el.addEventListener('click', () => this.hideSuccess());
        });
      }

      // Listen for cart additions (Standard event)
      document.addEventListener('cart:add', () => {
        this.trigger('cart');
      });

      // Listen for theme-specific cart updates (Quantity changes, removals)
      document.addEventListener('cart:update', () => {
        this.updateText();
      });

      // Initial text update
      this.updateText();
    }

    async updateText() {
      const activeCard = document.getElementById('CartPromoCard');
      if (activeCard) {
        activeCard.classList.add('is-loading');
      }

      try {
        const response = await fetch('/cart.js');
        const cart = await response.json();
        
        const ENGRAVING_VARIANT_ID = 48572858400991;
        let count = 0;
        cart.items.forEach(item => {
          if (item.variant_id !== ENGRAVING_VARIANT_ID) {
            count += item.quantity;
          }
        });

        // Check if we just hit the 3-item threshold
        if (this.previousCount !== null && this.previousCount < 3 && count >= 3) {
          this.celebrate();
        }
        this.previousCount = count;

        let text = '';
        let cardText = '';
        
        if (count === 0) {
          text = 'Add 3 more products to unlock an exclusive deal';
          cardText = 'Add 3 more to unlock';
        } else if (count === 1) {
          text = 'Add 2 more products to unlock an exclusive deal';
          cardText = 'Add 2 more to unlock';
        } else if (count === 2) {
          text = 'Add only 1 more product to unlock an exclusive deal!';
          cardText = 'Add 1 more to unlock';
        } else {
          text = 'You have unlocked an exclusive special deal! Checkout now.';
          cardText = 'Reward unlocked';
        }

        // Dynamically query DOM on each update to ensure references aren't stale after morphing
        const activePopupTextEl = document.querySelector('#PromoPopup [data-promo-text]');
        const activeCardTextEl = document.querySelector('#CartPromoCard [data-cart-promo-text]');

        if (activePopupTextEl) activePopupTextEl.textContent = text;
        if (activeCardTextEl) activeCardTextEl.textContent = cardText.toUpperCase();
        
        return count;
      } catch (e) {
        console.error('Failed to update promo text', e);
      } finally {
        if (activeCard) {
          // A tiny delay makes the loading transition feel smoother and more deliberate
          setTimeout(() => {
            const currentCard = document.getElementById('CartPromoCard');
            if (currentCard) currentCard.classList.remove('is-loading');
          }, 300);
        }
      }
    }

    celebrate() {
      if (!this.successPopup) return;
      
      this.successPopup.showModal();
      this.successPopup.setAttribute('aria-hidden', 'false');
      
      // Fire Confetti!
      if (window.confetti) {
        const canvas = document.getElementById('DiscountSuccessConfettiCanvas');
        if (canvas) {
          // Initialize canvas-confetti on the custom top-layer dialog canvas
          const myConfetti = confetti.create(canvas, {
            resize: true,
            useWorker: true
          });

          const duration = 3 * 1000;
          const animationEnd = Date.now() + duration;
          const defaults = { startVelocity: 30, spread: 360, ticks: 60 };

          const randomInRange = (min, max) => Math.random() * (max - min) + min;

          const interval = setInterval(() => {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
              return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);
            myConfetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: 0.3 } });
            myConfetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: 0.3 } });
          }, 250);
        } else {
          // Fallback to standard global confetti if canvas element is not present
          const duration = 3 * 1000;
          const animationEnd = Date.now() + duration;
          const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 20001 };

          const randomInRange = (min, max) => Math.random() * (max - min) + min;

          const interval = setInterval(() => {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
              return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
          }, 250);
        }
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
      if (!this.popup || this.popup.classList.contains('is-active')) return;
      
      this.popup.classList.add('is-active');
      this.popup.setAttribute('aria-hidden', 'false');
      sessionStorage.setItem(STORAGE_KEY, 'true');
    }

    hide() {
      if (!this.popup) return;
      this.popup.classList.remove('is-active');
      this.popup.setAttribute('aria-hidden', 'true');
    }

    hideSuccess() {
      if (!this.successPopup) return;
      this.successPopup.close();
      this.successPopup.setAttribute('aria-hidden', 'true');
    }
  }

  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    new PromoPopup();
  });
})();

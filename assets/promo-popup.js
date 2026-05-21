/**
 * PromoPopup — Logic for showing buy 3 get 40% discount popup.
 */
(function() {
  'use strict';

  const POPUP_ID = 'PromoPopup';


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
      console.log('PromoPopup: Initializing...');
      // Close events for main promo popup
      if (this.popup) {
        [this.closeBtn, this.overlay, this.secondaryBtn].forEach(el => {
          if (el) el.addEventListener('click', () => this.hide());
        });
      }

      // Close events for success popup
      if (this.successPopup) {
        [this.successCloseBtn, this.successOverlay, this.successSecondaryBtn, this.successMainBtn].forEach(el => {
          if (el) el.addEventListener('click', () => this.hideSuccess());
        });
      }

      // Listen for theme-specific cart updates (Quantity changes, removals, additions)
      document.addEventListener('cart:update', (e) => {
        console.log('PromoPopup: cart:update event received', e);
        this.updateText();
      });

      // Listen for cart drawer opening to ensure popups remain on top layer
      document.addEventListener('dialog:open', (e) => {
        if (e.target.id === 'cart-drawer') {
          console.log('PromoPopup: Cart drawer opened! Re-pushing promo popups if active...');
          if (this.popup && this.popup.open) {
            this.popup.close();
            this.popup.showModal();
          }
          if (this.successPopup && this.successPopup.open) {
            this.successPopup.close();
            this.successPopup.showModal();
          }
          this.updateText();
        }
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
        console.log('PromoPopup: Fetching cart...');
        const response = await fetch('/cart.js?t=' + Date.now());
        const cart = await response.json();
        
        const ENGRAVING_VARIANT_ID = 48572858400991;
        let count = 0;
        cart.items.forEach(item => {
          if (item.variant_id !== ENGRAVING_VARIANT_ID) {
            count += item.quantity;
          }
        });

        // Retrieve previous count from sessionStorage if available, otherwise fallback to memory
        let prevCount = this.previousCount;
        const storedPrev = sessionStorage.getItem('promo_cart_prev_count');
        if (storedPrev !== null) {
          prevCount = parseInt(storedPrev, 10);
        }

        console.log('PromoPopup: cart items count: ' + count + ', previous (memory): ' + this.previousCount + ', previous (stored): ' + prevCount);

        // Check if we just hit the 3-item threshold
        if (prevCount !== null && prevCount < 3 && count >= 3) {
          console.log('PromoPopup: Celebrating 3+ items!');
          this.celebrate();
        }

        // Show popup if quantity increased from 0
        if (prevCount === 0 && count > 0) {
          console.log('PromoPopup: Showing popup! Count went from 0 to ' + count);
          this.show();
        }

        this.previousCount = count;
        sessionStorage.setItem('promo_cart_prev_count', count.toString());

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
          cardText = 'Discount unlocked';
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

    show() {
      if (!this.popup || this.popup.open) return;
      if (typeof this.popup.showModal === 'function') {
        this.popup.showModal();
      }
      this.popup.classList.add('is-active');
      this.popup.setAttribute('aria-hidden', 'false');
    }

    hide() {
      if (!this.popup) return;
      if (typeof this.popup.close === 'function') {
        this.popup.close();
      }
      this.popup.classList.remove('is-active');
      this.popup.setAttribute('aria-hidden', 'true');
    }

    hideSuccess() {
      if (!this.successPopup) return;
      this.successPopup.close();
      this.successPopup.setAttribute('aria-hidden', 'true');
    }
  }

  // Initialize when DOM is ready or immediately if already loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new PromoPopup());
  } else {
    new PromoPopup();
  }
})();

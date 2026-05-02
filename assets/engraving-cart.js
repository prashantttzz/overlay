/**
 * EngravingCart — AJAX cart controller for the Engraving add-on feature.
 *
 * Manages adding/removing the engraving variant (48572858400991) as a paired
 * line item alongside the main product. Handles quantity sync, orphan cleanup,
 * and cart drawer refresh.
 *
 * Usage:
 *   window.EngravingCart.addEngraving('John & Sarah', 2);
 *   window.EngravingCart.removeEngraving('John & Sarah');
 *   window.EngravingCart.syncQuantity('John & Sarah', 3);
 *   window.EngravingCart.cleanOrphanedEngravings();
 */

(function () {
  'use strict';

  const ENGRAVING_VARIANT_ID = 48572858400991;

  const EngravingCart = {
    VARIANT_ID: ENGRAVING_VARIANT_ID,

    /**
     * Fetch the current cart state.
     * @returns {Promise<Object>} The cart JSON.
     */
    async getCart() {
      const res = await fetch('/cart.js', {
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
      });
      return res.json();
    },

    /**
     * Find an engraving line item by its "Engraving Text" property value.
     * @param {Object} cart - The cart object from /cart.js.
     * @param {string} engravingText - The text to match.
     * @returns {Object|undefined} The matching line item, or undefined.
     */
    findEngravingLine(cart, engravingText) {
      return cart.items.find(
        (item) =>
          item.variant_id === ENGRAVING_VARIANT_ID &&
          item.properties &&
          item.properties['Engraving Text'] === engravingText
      );
    },

    /**
     * Find the unique line item key of an engraving item.
     * @param {Object} cart - The cart object.
     * @param {string} engravingText - The text to match.
     * @returns {string|null} Line item key, or null.
     */
    findEngravingLineKey(cart, engravingText) {
      const item = cart.items.find(
        (item) =>
          item.variant_id === ENGRAVING_VARIANT_ID &&
          item.properties &&
          item.properties['Engraving Text'] === engravingText
      );
      return item ? item.key : null;
    },

    /**
     * Add the engraving variant to the cart.
     * @param {string} text - The engraving text.
     * @param {number} [quantity=1] - Number of engravings.
     * @returns {Promise<Object>} Response from /cart/add.js.
     */
    async addEngraving(text, quantity) {
      if (!text) return;
      quantity = quantity || 1;

      const body = {
        items: [
          {
            id: ENGRAVING_VARIANT_ID,
            quantity: quantity,
            properties: { 'Engraving Text': text },
          },
        ],
      };

      const res = await fetch('/cart/add.js', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      return res.json();
    },

    /**
     * Remove an engraving line item from the cart completely.
     * @param {string} engravingText - The engraving text to match.
     * @returns {Promise<void>}
     */
    async removeEngraving(engravingText) {
      if (!engravingText) return;

      const cart = await this.getCart();
      const lineKey = this.findEngravingLineKey(cart, engravingText);
      if (!lineKey) return;

      await fetch('/cart/change.js', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lineKey, quantity: 0 }),
      });
    },

    /**
     * Update the quantity of an engraving line item.
     * @param {string} engravingText - The engraving text to match.
     * @param {number} newQty - The new quantity.
     * @returns {Promise<void>}
     */
    async syncQuantity(engravingText, newQty) {
      if (!engravingText) return;

      const cart = await this.getCart();
      const line = this.findEngravingLine(cart, engravingText);
      if (!line) return;

      // Only update if quantity actually differs
      if (line.quantity === newQty) return;

      if (newQty <= 0) {
        await this.removeEngraving(engravingText);
      } else {
        await fetch('/cart/change.js', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: line.key, quantity: newQty }),
        });
      }
    },

    /**
     * The master management function:
     * 1. Sums up all required engraving quantities from main products.
     * 2. Identifies engraving line items that no longer have a parent (orphans).
     * 3. Syncs quantities for active engravings and removes orphans.
     * 4. Refreshes the UI with latest sections.
     * 
     * @param {boolean} [forceRefresh=false] - Whether to force a UI refresh.
     * @param {Object} [providedCart=null] - Optional cart data to use.
     */
    async manageEngravings(forceRefresh = false, providedCart = null) {
      const cart = providedCart || await this.getCart();
      const requiredQuantities = {};
      const updates = {};
      let changed = false;

      if (!cart || !cart.items) return;

      // Pass 1: Collect required quantities from main products
      cart.items.forEach((item) => {
        if (item.variant_id === ENGRAVING_VARIANT_ID) return;
        const text = item.properties ? item.properties['Engraving Text'] : null;
        if (text) {
          requiredQuantities[text] = (requiredQuantities[text] || 0) + item.quantity;
        }
      });

      // Pass 2: Identify engraving lines as active or orphaned
      cart.items.forEach((item) => {
        if (item.variant_id !== ENGRAVING_VARIANT_ID) return;
        const text = item.properties ? item.properties['Engraving Text'] : null;
        
        if (text && requiredQuantities[text] !== undefined) {
          const targetQty = requiredQuantities[text];
          if (item.quantity !== targetQty) {
            updates[item.key] = targetQty;
            changed = true;
          }
          delete requiredQuantities[text];
        } else {
          // Orphan found
          updates[item.key] = 0;
          changed = true;
        }
      });

      if (changed || forceRefresh) {
        // Collect sections to refresh
        const sectionIds = [];
        document.querySelectorAll('cart-items-component').forEach(el => {
          if (el.dataset.sectionId) sectionIds.push(el.dataset.sectionId);
        });

        const body = { updates };
        if (sectionIds.length > 0) {
          body.sections = sectionIds.join(',');
          body.sections_url = window.location.pathname;
        }

        const res = await fetch('/cart/update.js', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        
        const responseData = await res.json();
        
        // Calculate visible count (excluding engravings)
        let visibleCount = 0;
        if (responseData.items) {
          responseData.items.forEach((item) => {
            if (item.variant_id !== ENGRAVING_VARIANT_ID) {
              visibleCount += item.quantity;
            }
          });
        } else {
          // Fallback if items not in response (though update.js should have it)
          visibleCount = responseData.item_count;
        }

        // Notify other components
        document.dispatchEvent(new CustomEvent('cart:update', {
          bubbles: true,
          detail: { 
            resource: responseData,
            data: { 
              sections: responseData.sections || {},
              itemCount: visibleCount 
            } 
          }
        }));

        // Handle empty cart state visually
        const dialog = document.querySelector('.cart-drawer__dialog');
        if (dialog) {
          if (responseData.item_count === 0) {
            dialog.classList.add('cart-drawer--empty');
          } else {
            dialog.classList.remove('cart-drawer--empty');
          }
        }

        // Refresh UI
        if (responseData.sections) {
          this.renderSections(responseData.sections);
        } else {
          await this.refreshCartDrawer();
        }
      } else {
        this.updateCartBubble();
      }
    },

    /**
     * Render sections from a Shopify AJAX response.
     * @param {Object} sections - Map of section ID to HTML string.
     */
    renderSections(sections) {
      Object.keys(sections).forEach(id => {
        const html = sections[id];
        const currentSection = document.querySelector(`[data-section-id="${id}"]`);
        
        if (currentSection && html) {
          currentSection.innerHTML = html;
        }
      });
      this.updateCartBubble();
    },

    /**
     * Refresh the cart drawer by re-rendering cart sections.
     * @returns {Promise<void>}
     */
    async refreshCartDrawer() {
      const sections = document.querySelectorAll('cart-items-component');
      const sectionIds = [];
      sections.forEach((section) => {
        const id = section.dataset.sectionId;
        if (id) sectionIds.push(id);
      });

      if (sectionIds.length === 0) return;

      // Fetch updated section HTML
      const params = new URLSearchParams();
      sectionIds.forEach((id) => params.append('sections', id));

      try {
        const res = await fetch('/cart.js?' + params.toString(), {
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
        });
        const cartData = await res.json();

        // If the theme exposes a morph/render function, use it
        // Otherwise dispatch a cart update event to trigger re-render
        if (cartData.sections) {
          sectionIds.forEach((id) => {
            if (cartData.sections[id]) {
              const parser = new DOMParser();
              const newDoc = parser.parseFromString(cartData.sections[id], 'text/html');
              const currentSection = document.querySelector(
                '[data-section-id="' + id + '"]'
              );
              if (currentSection && currentSection.closest('.shopify-section')) {
                const sectionEl = currentSection.closest('.shopify-section');
                const newSectionContent = newDoc.querySelector('.shopify-section');
                if (sectionEl && newSectionContent) {
                  sectionEl.innerHTML = newSectionContent.innerHTML;
                }
              }
            }
          });
        }
      } catch (e) {
        // Fallback: force page section re-render via the theme's section renderer
        try {
          // Try to use Shopify Section Rendering API directly
          const sectionParam = sectionIds.map((id) => 'sections=' + id).join('&');
          const sectionRes = await fetch(
            window.location.pathname + '?' + sectionParam,
            {
              credentials: 'same-origin',
              headers: { 'X-Requested-With': 'XMLHttpRequest' },
            }
          );
          const sectionData = await sectionRes.json();
          sectionIds.forEach((id) => {
            if (sectionData[id]) {
              const sectionEl = document.getElementById('shopify-section-' + id);
              if (sectionEl) {
                sectionEl.innerHTML = sectionData[id];
              }
            }
          });
        } catch (fallbackErr) {
          // Last resort: reload page
          console.warn('[EngravingCart] Could not refresh cart drawer', fallbackErr);
        }
      }

      // Update cart icon count
      this.updateCartBubble();
    },

    /**
     * Update the cart bubble count, excluding engraving items.
     */
    async updateCartBubble() {
      try {
        const cart = await this.getCart();
        let visibleCount = 0;
        cart.items.forEach((item) => {
          if (item.variant_id !== ENGRAVING_VARIANT_ID) {
            visibleCount += item.quantity;
          }
        });

        // 1. Update the Cart Drawer heading specifically
        const drawerHeadingBubble = document.querySelector('.cart-drawer__heading .cart-bubble');
        if (drawerHeadingBubble) {
          drawerHeadingBubble.textContent = String(visibleCount).padStart(2, '0') + ' ITEMS';
        }

        // 2. Update the Header Cart Icon badge (numeric bubble)
        // Target the specific count element to preserve badge styling (background, etc.)
        const headerBubbles = document.querySelectorAll('.header-actions__cart-icon [ref="cartBubbleCount"]');
        headerBubbles.forEach((el) => {
          el.textContent = visibleCount;
          // Toggle visibility if count is 0
          el.classList.toggle('hidden', visibleCount === 0);
          const bubbleContainer = el.closest('.cart-bubble');
          if (bubbleContainer) {
            bubbleContainer.classList.toggle('visually-hidden', visibleCount === 0);
          }
        });
      } catch (e) {
        // Non-critical, fail silently
      }
    },
  };

  // Expose globally
  window.EngravingCart = EngravingCart;

  // ==========================================================================
  // EVENT LISTENERS — quantity sync + orphan cleanup after cart changes
  // ==========================================================================

  let syncDebounce = null;

  function debouncedSync(delay = 800) {
    clearTimeout(syncDebounce);
    syncDebounce = setTimeout(async () => {
      if (window.EngravingCart) {
        await window.EngravingCart.manageEngravings();
      }
    }, delay);
  }

  // Listen for theme cart events directly for faster response
  document.addEventListener('cart:update', (e) => {
    const cart = e.detail?.resource;
    if (cart && cart.items) {
      // If items were removed, sync immediately (shorter delay)
      window.EngravingCart.manageEngravings(false, cart);
    } else {
      debouncedSync(50);
    }
  });

  document.addEventListener('cart:add', (e) => {
    const cart = e.detail?.resource;
    if (cart && cart.items) {
      window.EngravingCart.manageEngravings(false, cart);
    } else {
      debouncedSync(800);
    }
  });

  // Observe cart drawer for changes (morph-based re-renders)
  const observeCartDrawer = () => {
    const drawer = document.querySelector('cart-items-component');
    if (!drawer) return;

    const observer = new MutationObserver((mutations) => {
      // If we see nodes being removed, sync faster
      const hasRemovals = mutations.some(m => m.removedNodes.length > 0);
      debouncedSync(hasRemovals ? 50 : 500);
    });

    observer.observe(drawer, { childList: true, subtree: true });
  };

  // Start observing when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeCartDrawer);
  } else {
    observeCartDrawer();
  }

  // Also run cleanup when cart drawer opens
  document.addEventListener('click', (e) => {
    const cartTrigger = e.target.closest('cart-drawer-component button');
    if (cartTrigger) {
      setTimeout(debouncedSync, 500);
    }
  });
})();

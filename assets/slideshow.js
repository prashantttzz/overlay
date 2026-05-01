
import { Component } from '@theme/component';

export class Slideshow extends Component {
  static refs = {
    slides: 'slides',
    viewport: 'viewport',
  };

  connectedCallback() {
    super.connectedCallback();
    this.currentIndex = parseInt(this.dataset.initialSlide) || 0;
    this.slideCount = parseInt(this.dataset.slideCount) || 0;
    this.infinite = this.dataset.infinite === 'true';

    this.update();
  }

  next() {
    this.select(this.currentIndex + 1);
  }

  prev() {
    this.select(this.currentIndex - 1);
  }

  select(index, event, options = {}) {
    const { animate = true } = options;
    
    let newIndex = index;
    if (this.infinite) {
      newIndex = (index + this.slideCount) % this.slideCount;
    } else {
      newIndex = Math.max(0, Math.min(index, this.slideCount - 1));
    }

    if (newIndex === this.currentIndex && animate) return;

    this.currentIndex = newIndex;
    this.update(animate);
    
    // Dispatch event for other components (like pagination)
    this.dispatchEvent(new CustomEvent('slideshow:change', {
      detail: { index: this.currentIndex }
    }));
  }

  update(animate = true) {
    const slidesContainer = this.refs.slides;
    if (!slidesContainer) return;

    if (!animate) {
      slidesContainer.style.transition = 'none';
    } else {
      slidesContainer.style.transition = '';
    }

    const offset = this.currentIndex * -100;
    slidesContainer.style.transform = `translateX(${offset}%)`;

    // Update pagination dots if they exist
    this.querySelectorAll('.slideshow__dot, .slideshow__thumbnail').forEach((dot, i) => {
      dot.classList.toggle('is-active', i === this.currentIndex);
    });

    // Update counter if it exists
    const counter = this.querySelector('.slideshow__counter-current');
    if (counter) counter.textContent = this.currentIndex + 1;

    if (!animate) {
      // Force reflow
      slidesContainer.offsetHeight;
      slidesContainer.style.transition = '';
    }
  }
}

if (!customElements.get('slideshow-component')) {
  customElements.define('slideshow-component', Slideshow);
}

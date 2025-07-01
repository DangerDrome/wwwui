/**
 * @license fullpage-vanilla v1.0.0
 * https://github.com/your-repo/fullpage-vanilla
 *
 * Copyright (C) 2023 Your Name - All rights reserved.
 *
 * Released under the MIT license.
 */
(function (global) {
  'use strict';

  // --- Constants ---
  const ACTIVE_ATTR = 'data-active';
  const SECTION_SELECTOR = '.fp-section';
  const SLIDES_SELECTOR = '.fp-slides';
  const SLIDE_SELECTOR = '.fp-slide';
  const SLIDE_PREV_SELECTOR = '[data-slide-prev]';
  const SLIDE_NEXT_SELECTOR = '[data-slide-next]';
  const TRANSITION_DURATION = 400; // ms

  // --- State ---
  let config = {};
  let sectionElements = [];
  let currentSectionIndex = 0;
  let isTransitioning = false;
  let isDragging = false;
  let autoScrollTimer = null;
  let touchStart = { y: 0, x: 0 };
  let slideElements = [];
  let currentSlideIndex = 0;
  let isInSlideMode = false;

  // --- Core Logic ---

  /**
   * Updates the visible section with an optional animation.
   * @param {number} newIndex - The index of the section to navigate to.
   * @param {boolean} animate - Whether to animate the transition.
   */
  function updateSection(newIndex, animate) {
    if (typeof config.onSectionLeave === 'function') {
      config.onSectionLeave(currentSectionIndex);
    }
    isTransitioning = true;
    const total = sectionElements.length;
    const oldIndex = currentSectionIndex;

    sectionElements.forEach((el, i) => {
      // Calculate previous and new positions based on the infinite scroll logic
      let oldOffset = i - oldIndex;
      if (oldOffset < -Math.floor(total / 2)) oldOffset += total;
      if (oldOffset > Math.floor(total / 2)) oldOffset -= total;

      let newOffset = i - newIndex;
      if (newOffset < -Math.floor(total / 2)) newOffset += total;
      if (newOffset > Math.floor(total / 2)) newOffset -= total;

      // Check if the section is 'jumping' across the stack to create the seamless loop
      const isJumping = Math.round(Math.abs(newOffset - oldOffset)) > 1;

      // Apply transition only if animating and the section is not the one jumping.
      // The jumping section is moved instantly to its new position.
      const transitionStyle = animate && !isJumping ? `transform ${TRANSITION_DURATION}ms ${config.easing}` : 'none';
      
      el.style.transition = transitionStyle;
      el.style.transform = `translateY(${newOffset * 100}vh)`;
      el.setAttribute(ACTIVE_ATTR, i === newIndex ? 'true' : 'false');
    });

    currentSectionIndex = newIndex;
    updateNavDots();

    setTimeout(() => {
      isTransitioning = false;
      if (typeof config.onSectionEnter === 'function') {
        config.onSectionEnter(currentSectionIndex);
      }
      if (sectionElements[currentSectionIndex].querySelector(SLIDES_SELECTOR)) {
        isInSlideMode = true;
        setupSlides(sectionElements[currentSectionIndex]);
        updateSlide(0, false);
      } else {
        isInSlideMode = false;
        slideElements = [];
        currentSlideIndex = 0;
      }
      if (config.autoScroll) restartAutoScroll();
    }, animate ? TRANSITION_DURATION : 0);
  }

  /**
   * Updates the visible slide within a section.
   * @param {number} newIndex - The index of the slide to navigate to.
   * @param {boolean} animate - Whether to animate the transition.
   */
  function updateSlide(newIndex, animate) {
    const total = slideElements.length;
    if (!total) return;

    const oldIndex = currentSlideIndex;
    currentSlideIndex = ((newIndex % total) + total) % total;

    slideElements.forEach((slide, i) => {
      let oldOffset = i - oldIndex;
      if (oldOffset < -Math.floor(total / 2)) oldOffset += total;
      if (oldOffset > Math.floor(total / 2)) oldOffset -= total;

      let newOffset = i - currentSlideIndex;
      if (newOffset < -Math.floor(total / 2)) newOffset += total;
      if (newOffset > Math.floor(total / 2)) newOffset -= total;

      const isJumping = Math.round(Math.abs(newOffset - oldOffset)) > 1;
      const transitionStyle = animate && !isJumping ? `transform ${TRANSITION_DURATION}ms ${config.easing}` : 'none';

      slide.style.transition = transitionStyle;
      slide.style.transform = `translateX(${newOffset * 100}vw)`;
      slide.setAttribute(ACTIVE_ATTR, i === currentSlideIndex ? 'true' : 'false');
    });

    if (config.autoScroll) {
      if (animate) {
        setTimeout(() => restartAutoScroll(), TRANSITION_DURATION);
      } else {
        restartAutoScroll();
      }
    }
  }

  // --- Navigation ---

  /**
   * Programmatically navigates to the specified section index.
   * @param {number} index - The destination section index.
   */
  function moveTo(index) {
    if (isTransitioning) return;
    const total = sectionElements.length;
    const newIndex = ((index % total) + total) % total;
    updateSection(newIndex, true);
  }

  /**
   * Navigates to the next section.
   */
  function moveDown() {
    moveTo(currentSectionIndex + 1);
  }

  /**
   * Navigates to the previous section.
   */
  function moveUp() {
    moveTo(currentSectionIndex - 1);
  }

  /**
   * Navigates to the next slide.
   */
  function handleSlideNext() {
    updateSlide(currentSlideIndex + 1, true);
  }

  /**
   * Navigates to the previous slide.
   */
  function handleSlidePrev() {
    updateSlide(currentSlideIndex - 1, true);
  }

  // --- Event Handlers ---

  function handleWheel(e) {
    e.preventDefault();
    if (isTransitioning) return;

    if (isInSlideMode) {
      if (e.deltaX > 30) return handleSlideNext();
      if (e.deltaX < -30) return handleSlidePrev();
    }
    if (e.deltaY > 30) return moveDown();
    if (e.deltaY < -30) return moveUp();
  }

  function handleKeyDown(e) {
    if (isTransitioning) return;
    if (isInSlideMode) {
      if (e.key === 'ArrowRight') return handleSlideNext();
      if (e.key === 'ArrowLeft') return handleSlidePrev();
    }
    if (e.key === 'ArrowDown' || e.key === 'PageDown') return moveDown();
    if (e.key === 'ArrowUp' || e.key === 'PageUp') return moveUp();
  }

  function handleTouchStart(e) {
    if (isTransitioning || e.touches.length !== 1) return;

    isDragging = true;
    touchStart.y = e.touches[0].clientY;
    touchStart.x = e.touches[0].clientX;
    
    stopAutoScroll();

    // Disable transitions for manual dragging
    sectionElements.forEach(el => {
      el.style.transition = 'none';
    });
    // Also disable transitions for slides if they exist
    if (slideElements.length) {
      slideElements.forEach(slide => {
        slide.style.transition = 'none';
      });
    }
  }

  function handleTouchMove(e) {
    if (!isDragging) return;
    e.preventDefault();

    const deltaY = e.touches[0].clientY - touchStart.y;
    const deltaX = e.touches[0].clientX - touchStart.x;
    
    // Prioritize vertical or horizontal drag
    if (isInSlideMode && Math.abs(deltaX) > Math.abs(deltaY)) {
      // Dragging slides horizontally
      const totalSlides = slideElements.length;
      slideElements.forEach((slide, i) => {
        let offset = i - currentSlideIndex;
        if (offset < -Math.floor(totalSlides / 2)) offset += totalSlides;
        if (offset > Math.floor(totalSlides / 2)) offset -= totalSlides;
        slide.style.transform = `translateX(calc(${offset * 100}vw + ${deltaX}px))`;
      });
    } else {
      // Dragging sections vertically
      const total = sectionElements.length;
      sectionElements.forEach((el, i) => {
        let offset = i - currentSectionIndex;
        if (offset < -Math.floor(total / 2)) offset += total;
        if (offset > Math.floor(total / 2)) offset -= total;
        el.style.transform = `translateY(calc(${offset * 100}vh + ${deltaY}px))`;
      });
    }
  }

  function handleTouchEnd(e) {
    if (!isDragging) return;
    isDragging = false;
    
    const DRAG_THRESHOLD = 50; // Min pixels to trigger a scroll
    const deltaY = e.changedTouches[0].clientY - touchStart.y;
    const deltaX = e.changedTouches[0].clientX - touchStart.x;

    // Re-enable transitions for all elements for the snap animation
    sectionElements.forEach(el => {
      el.style.transition = `transform ${TRANSITION_DURATION}ms ${config.easing}`;
    });
    if (slideElements.length) {
      slideElements.forEach(slide => {
        slide.style.transition = `transform ${TRANSITION_DURATION}ms ${config.easing}`;
      });
    }
    
    if (isInSlideMode && Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > DRAG_THRESHOLD) {
      deltaX < 0 ? handleSlideNext() : handleSlidePrev();
    } else if (Math.abs(deltaY) > DRAG_THRESHOLD) {
      deltaY < 0 ? moveDown() : moveUp();
    } else {
      // Didn't meet threshold, snap back to current section and slide
      updateSection(currentSectionIndex, true);
      updateSlide(currentSlideIndex, true);
    }
  }

  function handleResize() {
    updateSection(currentSectionIndex, false);
    updateSlide(currentSlideIndex, false);
  }

  // --- Auto Scroll ---

  function startAutoScroll() {
    stopAutoScroll();
    autoScrollTimer = setInterval(moveDown, config.autoScrollDelay);
  }

  function stopAutoScroll() {
    if (autoScrollTimer) clearInterval(autoScrollTimer);
    autoScrollTimer = null;
  }

  function restartAutoScroll() {
    if (config.autoScroll) {
      stopAutoScroll();
      startAutoScroll();
    }
  }

  // --- Setup ---

  /**
   * Caches slide elements and sets up their initial state.
   * @param {HTMLElement} section - The section containing the slides.
   */
  function setupSlides(section) {
    const slidesContainer = section.querySelector(SLIDES_SELECTOR);
    if (!slidesContainer) {
      slideElements = [];
      currentSlideIndex = 0;
      return;
    }

    slideElements = Array.from(slidesContainer.querySelectorAll(SLIDE_SELECTOR));
    currentSlideIndex = 0;
    
    // Initialize slide positions
    slideElements.forEach((slide, i) => {
      slide.style.position = 'absolute';
      slide.style.left = '0';
      slide.style.top = '0';
      slide.style.transform = `translateX(${i * 100}vw)`;
      slide.setAttribute(ACTIVE_ATTR, i === 0 ? 'true' : 'false');
    });
    
    const prevBtn = slidesContainer.querySelector(SLIDE_PREV_SELECTOR);
    const nextBtn = slidesContainer.querySelector(SLIDE_NEXT_SELECTOR);

    if (prevBtn) prevBtn.addEventListener('click', handleSlidePrev);
    if (nextBtn) nextBtn.addEventListener('click', handleSlideNext);
  }

  /**
   * Creates and appends navigation dots to the DOM.
   */
  function setupNavDots() {
    const nav = document.querySelector(config.navDots);
    if (!nav) return;
    nav.innerHTML = '';
    sectionElements.forEach((_, idx) => {
      const dot = document.createElement('button');
      dot.className = 'fp-dot';
      dot.setAttribute('aria-label', `Go to section ${idx + 1}`);
      dot.setAttribute('data-index', idx);
      dot.innerHTML = `<i data-lucide="circle"></i>`;
      dot.addEventListener('click', () => moveTo(idx));
      nav.appendChild(dot);
    });

    if (window.lucide) window.lucide.createIcons();
    updateNavDots();
  }

  /**
   * Updates the active state of navigation dots.
   */
  function updateNavDots() {
    const nav = document.querySelector(config.navDots);
    if (!nav) return;
    Array.from(nav.children).forEach((dot, idx) => {
      dot.setAttribute(ACTIVE_ATTR, idx === currentSectionIndex ? 'true' : 'false');
    });
  }

  /**
   * Binds all necessary event listeners.
   */
  function setupEvents() {
    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: false });
    window.addEventListener('resize', handleResize);
  }

  /**
   * Initializes the framework.
   * @param {object} options - User-defined configuration options.
   */
  function init(options) {
    config = Object.assign({
      root: '#fullpage-root',
      navDots: '#fp-nav-dots',
      autoScroll: false,
      autoScrollDelay: 5000,
      easing: 'cubic-bezier(0.77,0,0.175,1)',
      onSectionEnter: null,
      onSectionLeave: null,
    }, options);

    const root = document.querySelector(config.root);
    if (!root) throw new Error('FullPage root element not found.');

    sectionElements = Array.from(root.querySelectorAll(SECTION_SELECTOR));
    if (!sectionElements.length) throw new Error('No sections found.');

    sectionElements.forEach((el, idx) => {
      el.setAttribute('data-index', idx);
    });
    
    setupNavDots();
    setupEvents();
    
    updateSection(0, false);
    if (config.autoScroll) startAutoScroll();
  }

  // --- Public API ---
  global.fullpageFramework = {
    init,
    moveTo,
    moveUp,
    moveDown,
  };

})(window); 
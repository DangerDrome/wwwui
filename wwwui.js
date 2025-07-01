/**
 * @license wwwui v1.0.0
 * https://github.com/your-repo/wwwui
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
  let dragStart = { y: 0, x: 0 };
  let slideElements = [];
  let currentSlideIndex = 0;
  let slideStates = [];
  let slideSelectionStates = [];

  // --- Core Logic ---

  /**
   * Updates the visible section with an optional animation.
   * @param {number} newIndex - The index of the section to navigate to.
   * @param {boolean} animate - Whether to animate the transition.
   * @param {number|null} slideIndex - The optional destination slide index.
   * @param {string} direction - The direction of navigation ('up' or 'down').
   */
  function updateSection(newIndex, animate, slideIndex = null, direction = 'down') {
    if (typeof config.onSectionLeave === 'function') {
      config.onSectionLeave(currentSectionIndex);
    }
    isTransitioning = true;
    const total = sectionElements.length;
    const oldIndex = currentSectionIndex;

    // Determine the target slide for the new section immediately to prevent flicker.
    let targetSlide = slideIndex;
    if (targetSlide === null) {
      const currentSelection = slideSelectionStates[newIndex];
      const selectedIndexes = [];
      currentSelection.forEach((isSelected, index) => {
        if (isSelected) selectedIndexes.push(index);
      });

      if (selectedIndexes.length > 0) {
        targetSlide = direction === 'up' ? selectedIndexes[selectedIndexes.length - 1] : selectedIndexes[0];
      } else {
        targetSlide = 0; // Default to first slide if none are selected
      }
    }
    // Set the state for the upcoming slide *before* any UI updates.
    currentSlideIndex = targetSlide;

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
    updateMinimap();

    setTimeout(() => {
      isTransitioning = false;
      if (typeof config.onSectionEnter === 'function') {
        config.onSectionEnter(currentSectionIndex);
      }
      setupSlides(sectionElements[currentSectionIndex]);
      
      // The state (currentSlideIndex) is already correct.
      // Just apply the visual transition to the slide itself.
      updateSlide(currentSlideIndex, false); // No animation needed here

      updateMinimap(); // Also update minimap after slide setup
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

    // Store the new slide index for the current section
    if (typeof slideStates[currentSectionIndex] !== 'undefined') {
      slideStates[currentSectionIndex] = currentSlideIndex;
    }

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

    updateMinimap();

    if (config.autoScroll) {
      if (animate) {
        setTimeout(() => restartAutoScroll(), TRANSITION_DURATION);
      } else {
        restartAutoScroll();
      }
    }
  }

  /**
   * Traverse to a target section and slide, animating through each step.
   */
  function traverseTo(targetSectionIdx, targetSlideIdx) {
    if (isTransitioning) return;
    // If already at target, do nothing
    if (currentSectionIndex === targetSectionIdx && currentSlideIndex === targetSlideIdx) return;

    // If not in the target section, animate section by section
    if (currentSectionIndex !== targetSectionIdx) {
      const totalSections = sectionElements.length;
      let nextSection = currentSectionIndex;
      const direction = (targetSectionIdx > currentSectionIndex && (targetSectionIdx - currentSectionIndex) < totalSections / 2) || (currentSectionIndex - targetSectionIdx) > totalSections / 2 ? 1 : -1;
      nextSection = (nextSection + direction + totalSections) % totalSections;
      updateSection(nextSection, true);
      setTimeout(() => traverseTo(targetSectionIdx, targetSlideIdx), TRANSITION_DURATION + 10);
      return;
    }
    // Now in the correct section, animate through slides if needed
    if (currentSlideIndex !== targetSlideIdx) {
      const totalSlides = slideElements.length;
      let nextSlide = currentSlideIndex;
      const direction = (targetSlideIdx > currentSlideIndex && (targetSlideIdx - currentSlideIndex) < totalSlides / 2) || (currentSlideIndex - targetSlideIdx) > totalSlides / 2 ? 1 : -1;
      nextSlide = (nextSlide + direction + totalSlides) % totalSlides;
      updateSlide(nextSlide, true);
      setTimeout(() => traverseTo(targetSectionIdx, targetSlideIdx), TRANSITION_DURATION + 10);
      return;
    }
  }

  // --- Navigation ---

  /**
   * Programmatically navigates to the specified section index.
   * @param {number} index - The destination section index.
   * @param {number|null} slideIndex - The optional destination slide index.
   * @param {string} direction - The direction of navigation ('up' or 'down').
   */
  function moveTo(index, slideIndex = null, direction = 'down') {
    if (isTransitioning) return;
    const total = sectionElements.length;
    const newIndex = ((index % total) + total) % total;
    updateSection(newIndex, true, slideIndex, direction);
  }

  /**
   * Navigates to the next content element (slide or section).
   */
  function moveDown() {
    if (isTransitioning) return;

    const currentSelection = slideSelectionStates[currentSectionIndex];
    const selectedIndexes = [];
    currentSelection.forEach((isSelected, index) => {
      if (isSelected) selectedIndexes.push(index);
    });

    const nextSlideIndex = selectedIndexes.find(index => index > currentSlideIndex);

    if (nextSlideIndex !== undefined) {
      updateSlide(nextSlideIndex, true);
    } else {
      moveTo(currentSectionIndex + 1, null, 'down');
    }
  }

  /**
   * Navigates to the previous content element (slide or section).
   */
  function moveUp() {
    if (isTransitioning) return;

    const currentSelection = slideSelectionStates[currentSectionIndex];
    const selectedIndexes = [];
    currentSelection.forEach((isSelected, index) => {
      if (isSelected) selectedIndexes.push(index);
    });

    const prevSlideIndex = [...selectedIndexes].reverse().find(index => index < currentSlideIndex);

    if (prevSlideIndex !== undefined) {
      updateSlide(prevSlideIndex, true);
    } else {
      moveTo(currentSectionIndex - 1, null, 'up');
    }
  }

  /**
   * Navigates to the next slide.
   */
  function handleSlideNext() {
    const currentSelection = slideSelectionStates[currentSectionIndex];
    if (currentSelection.every(s => !s)) return; // Do nothing if all are off

    let nextIndex = currentSlideIndex;
    do {
      nextIndex = (nextIndex + 1) % slideElements.length;
    } while (!currentSelection[nextIndex]);
    
    updateSlide(nextIndex, true);
  }

  /**
   * Navigates to the previous slide.
   */
  function handleSlidePrev() {
    const currentSelection = slideSelectionStates[currentSectionIndex];
    if (currentSelection.every(s => !s)) return; // Do nothing if all are off

    let prevIndex = currentSlideIndex;
    do {
      prevIndex = (prevIndex - 1 + slideElements.length) % slideElements.length;
    } while (!currentSelection[prevIndex]);

    updateSlide(prevIndex, true);
  }

  function moveToNextSelectedSlide() {
    if (isTransitioning) return;

    const currentSelection = slideSelectionStates[currentSectionIndex];
    const selectedIndexes = [];
    currentSelection.forEach((isSelected, index) => {
      if (isSelected) selectedIndexes.push(index);
    });

    if (selectedIndexes.length === 0) {
      moveDown(); // No slides selected, move to the next section
      return;
    }

    const currentIndexInSelection = selectedIndexes.indexOf(currentSlideIndex);
    let nextIndexInSelection;

    if (currentIndexInSelection === -1) {
      // Current slide is not selected, jump to the first selected one
      nextIndexInSelection = 0;
    } else {
      // Move to the next selected slide, looping if necessary
      nextIndexInSelection = (currentIndexInSelection + 1) % selectedIndexes.length;
    }

    const nextSlideIndex = selectedIndexes[nextIndexInSelection];
    updateSlide(nextSlideIndex, true);
  }

  // --- Event Handlers ---

  function handleWheel(e) {
    e.preventDefault();
    if (isTransitioning) return;

    if (config.autoScroll) restartAutoScroll();

    // Prioritize horizontal scroll for slides
    if (e.deltaX > 30) return handleSlideNext();
    if (e.deltaX < -30) return handleSlidePrev();

    // Vertical scroll for sections
    if (e.deltaY > 30) return moveDown();
    if (e.deltaY < -30) return moveUp();
  }

  function handleKeyDown(e) {
    if (isTransitioning) return;

    if (config.autoScroll) restartAutoScroll();

    if (e.key === 'ArrowRight') return handleSlideNext();
    if (e.key === 'ArrowLeft') return handleSlidePrev();
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
    sectionElements.forEach(el => el.style.transition = 'none');
    slideElements.forEach(slide => slide.style.transition = 'none');
  }

  function handleTouchMove(e) {
    if (!isDragging) return;
    e.preventDefault();

    const deltaY = e.touches[0].clientY - touchStart.y;
    const deltaX = e.touches[0].clientX - touchStart.x;
    
    // Prioritize horizontal drag for slides
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
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
    sectionElements.forEach(el => el.style.transition = `transform ${TRANSITION_DURATION}ms ${config.easing}`);
    slideElements.forEach(slide => slide.style.transition = `transform ${TRANSITION_DURATION}ms ${config.easing}`);
    
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > DRAG_THRESHOLD) {
      deltaX < 0 ? handleSlideNext() : handleSlidePrev();
    } else if (Math.abs(deltaY) > DRAG_THRESHOLD) {
      deltaY < 0 ? moveDown() : moveUp();
    } else {
      // Didn't meet threshold, snap back to current section and slide
      updateSection(currentSectionIndex, true);
      updateSlide(currentSlideIndex, true);
    }
  }

  function handleMouseDown(e) {
    if (e.button !== 0 || isTransitioning) return; // Only main button

    isDragging = true;
    dragStart.y = e.clientY;
    dragStart.x = e.clientX;

    stopAutoScroll();

    const root = document.querySelector(config.root);
    root.style.cursor = 'grabbing';

    sectionElements.forEach(el => el.style.transition = 'none');
    slideElements.forEach(slide => slide.style.transition = 'none');
  }

  function handleMouseMove(e) {
    if (!isDragging) return;
    e.preventDefault();

    const deltaY = e.clientY - dragStart.y;
    const deltaX = e.clientX - dragStart.x;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      const totalSlides = slideElements.length;
      slideElements.forEach((slide, i) => {
        let offset = i - currentSlideIndex;
        if (offset < -Math.floor(totalSlides / 2)) offset += totalSlides;
        if (offset > Math.floor(totalSlides / 2)) offset -= totalSlides;
        slide.style.transform = `translateX(calc(${offset * 100}vw + ${deltaX}px))`;
      });
    } else {
      const total = sectionElements.length;
      sectionElements.forEach((el, i) => {
        let offset = i - currentSectionIndex;
        if (offset < -Math.floor(total / 2)) offset += total;
        if (offset > Math.floor(total / 2)) offset -= total;
        el.style.transform = `translateY(calc(${offset * 100}vh + ${deltaY}px))`;
      });
    }
  }

  function handleMouseUp(e) {
    if (!isDragging) return;
    isDragging = false;

    const root = document.querySelector(config.root);
    root.style.cursor = 'grab';

    const DRAG_THRESHOLD = 50;
    const deltaY = e.clientY - dragStart.y;
    const deltaX = e.clientX - dragStart.x;

    sectionElements.forEach(el => el.style.transition = `transform ${TRANSITION_DURATION}ms ${config.easing}`);
    slideElements.forEach(slide => slide.style.transition = `transform ${TRANSITION_DURATION}ms ${config.easing}`);

    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > DRAG_THRESHOLD) {
      deltaX < 0 ? handleSlideNext() : handleSlidePrev();
    } else if (Math.abs(deltaY) > DRAG_THRESHOLD) {
      deltaY < 0 ? moveDown() : moveUp();
    } else {
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
      
      const hasSelectedSlides = slideSelectionStates[currentSectionIndex] && slideSelectionStates[currentSectionIndex].some(s => s);
      
      if (hasSelectedSlides) {
        autoScrollTimer = setInterval(moveToNextSelectedSlide, config.autoScrollDelay);
      } else {
        autoScrollTimer = setInterval(moveDown, config.autoScrollDelay);
      }
    }
  }

  // --- Setup ---

  /**
   * Caches slide elements and sets up their initial state.
   * @param {HTMLElement} section - The section containing the slides.
   */
  function setupSlides(section) {
    const slidesContainer = section.querySelector(SLIDES_SELECTOR);
    slideElements = Array.from(slidesContainer.querySelectorAll(SLIDE_SELECTOR));
    
    // Initialize slide positions
    slideElements.forEach((slide, i) => {
      slide.style.position = 'absolute';
      slide.style.left = '0';
      slide.style.top = '0';
      slide.style.transform = `translateX(${i * 100}vw)`;
    });
    
    const prevBtn = slidesContainer.querySelector(SLIDE_PREV_SELECTOR);
    const nextBtn = slidesContainer.querySelector(SLIDE_NEXT_SELECTOR);

    if (prevBtn) prevBtn.addEventListener('click', handleSlidePrev);
    if (nextBtn) nextBtn.addEventListener('click', handleSlideNext);
  }

  /**
   * Creates and appends the minimap to the DOM.
   */
  function setupMinimap() {
    const minimapContainer = document.querySelector(config.minimap);
    if (!minimapContainer) return;
    minimapContainer.innerHTML = ''; // Clear existing

    // Create a single popover element for the whole minimap.
    const popover = document.createElement('div');
    popover.className = 'minimap-tooltip-popover';
    minimapContainer.appendChild(popover);

    minimapContainer.addEventListener('mouseleave', () => {
      popover.style.opacity = '0';
      popover.style.visibility = 'hidden';
    });

    // First, determine the maximum number of slides in any section.
    let maxSlides = 0;
    sectionElements.forEach(section => {
      const slides = section.querySelectorAll(SLIDE_SELECTOR);
      if (slides.length > maxSlides) {
        maxSlides = slides.length;
      }
    });
    
    sectionElements.forEach((section, idx) => {
      const row = document.createElement('div');
      row.className = 'minimap-row';

      // Restore section icon (diamond)
      const sectionDot = document.createElement('button');
      sectionDot.className = 'minimap-section';
      sectionDot.setAttribute('aria-label', `Go to section ${idx + 1}`);
      sectionDot.setAttribute('data-index', idx);
      const sectionTitleEl = section.querySelector('.section-title');
      const sectionTitle = sectionTitleEl ? sectionTitleEl.textContent.trim() : `Section ${idx + 1}`;
      sectionDot.setAttribute('data-tooltip', sectionTitle);
      sectionDot.innerHTML = `<i data-lucide="square"></i>`;
      sectionDot.addEventListener('click', () => {
        if (config.autoScroll) restartAutoScroll();
        moveTo(idx, 0, 'down');
      });
      sectionDot.addEventListener('mouseenter', () => {
        popover.textContent = sectionTitle;
        popover.style.opacity = '1';
        popover.style.visibility = 'visible';
      });
      row.appendChild(sectionDot);

      const slidesContainer = document.createElement('div');
      slidesContainer.className = 'minimap-slides-container';
      
      const slides = section.querySelectorAll(SLIDE_SELECTOR);
      const currentSlideCount = slides.length;

      // Add real slide dots
      for (let i = 0; i < currentSlideCount; i++) {
        const slideDot = document.createElement('button');
        slideDot.className = 'minimap-slide';
        slideDot.setAttribute('data-slide-index', i);
        const slideTitleEl = slides[i].querySelector('.section-title');
        const slideTitle = slideTitleEl ? slideTitleEl.textContent.trim() : `Slide ${i + 1}`;
        slideDot.setAttribute('data-tooltip', slideTitle);
        slideDot.innerHTML = `<i data-lucide="square"></i>`;
        slideDot.addEventListener('click', (e) => {
          e.stopPropagation();
          if (config.autoScroll) restartAutoScroll();
          // Always traverse to this slide
          traverseTo(idx, i);
          // Toggle the selection state
          if (slideSelectionStates[idx]) {
            slideSelectionStates[idx][i] = !slideSelectionStates[idx][i];
          }
          updateMinimap();
        });
        slideDot.addEventListener('mouseenter', () => {
          popover.textContent = slideTitle;
          popover.style.opacity = '1';
          popover.style.visibility = 'visible';
        });
        slidesContainer.appendChild(slideDot);
      }

      // Add placeholder dots for the remainder to complete the grid
      for (let i = currentSlideCount; i < maxSlides; i++) {
        const placeholder = document.createElement('span');
        placeholder.className = 'minimap-placeholder';
        placeholder.innerHTML = `<i data-lucide="square"></i>`;
        slidesContainer.appendChild(placeholder);
      }
      
      row.appendChild(slidesContainer);
      minimapContainer.appendChild(row);
    });

    if (window.lucide) {
      lucide.createIcons();
    }

    updateMinimap();
  }

  /**
   * Updates the active state of minimap dots.
   */
  function updateMinimap() {
    const minimapContainer = document.querySelector(config.minimap);
    if (!minimapContainer) return;

    const rows = minimapContainer.querySelectorAll('.minimap-row');
    rows.forEach((row, sectionIdx) => {
      const sectionDot = row.querySelector('.minimap-section');
      const slideDots = row.querySelectorAll('.minimap-slide');

      // Update section dot
      sectionDot.setAttribute(ACTIVE_ATTR, sectionIdx === currentSectionIndex ? 'true' : 'false');

      // Update slide dots
      slideDots.forEach((slideDot, slideIdx) => {
        slideDot.setAttribute(ACTIVE_ATTR, sectionIdx === currentSectionIndex && slideIdx === currentSlideIndex ? 'true' : 'false');
      });

      // Update selection state for all slides
      if (slideSelectionStates[sectionIdx]) {
        slideDots.forEach((slideDot, slideIdx) => {
          const isSelected = slideSelectionStates[sectionIdx][slideIdx];
          slideDot.setAttribute('data-selected', isSelected ? 'true' : 'false');
        });
      }
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

    const root = document.querySelector(config.root);
    if (root) {
      root.style.cursor = 'grab';
      root.addEventListener('mousedown', handleMouseDown, { passive: false });
      window.addEventListener('mousemove', handleMouseMove, { passive: false });
      window.addEventListener('mouseup', handleMouseUp, { passive: false });
    }
  }

  /**
   * Initializes the framework.
   * @param {object} options - User-defined configuration options.
   */
  function init(options) {
    config = Object.assign({
      root: '#fullpage-root',
      minimap: null,
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
      slideStates[idx] = 0; // Initialize slide state for each section

      const slides = el.querySelectorAll(SLIDE_SELECTOR);
      slideSelectionStates[idx] = Array(slides.length).fill(true);
    });
    
    setupMinimap();
    setupEvents();
    
    updateSection(0, false);
  }

  // --- Public API ---
  global.wwwui = {
    init,
    moveTo,
    moveUp,
    moveDown,
  };

})(window); 
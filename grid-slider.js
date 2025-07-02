/**
 * Grid Slider
 * A vanilla JavaScript library for creating an infinite, draggable, 3x3 grid layout.
 * Supports navigation via mouse drag, scroll wheel, keyboard arrows, and UI buttons.
 */

document.addEventListener('DOMContentLoaded', () => {

    // --- Configuration & Constants ---
    const BASE_GRID_COLS = 3; // The visible number of columns in the grid.
    const BASE_GRID_ROWS = 3; // The visible number of rows in the grid.
    const TRANSITION_DURATION_MS = 400; // Duration for slide and logo animations.
    const DRAG_THRESHOLD_DIVISOR = 8; // Lower number means a longer drag is needed to change cells.
    const AXIS_LOCK_THRESHOLD_PX = 1; // Pixels to drag before locking movement to one axis.
    const POPOVER_OFFSET_PX = 15; // Distance of the arrow popover from the arrow button.
    const EDGE_DETECTION_THRESHOLD_PX = 100; // Distance from edge to show navigation arrows.

    // --- Derived Constants ---
    const VIRTUAL_GRID_COLS = BASE_GRID_COLS + 2; // Grid cols including cloned buffer cells for looping.
    const VIRTUAL_GRID_ROWS = BASE_GRID_ROWS + 2; // Grid rows including cloned buffer cells for looping.

    // --- DOM Elements ---
    const container = document.getElementById('grid-container');
    const wrapper = document.getElementById('grid-wrapper');
    const originalItems = Array.from(wrapper.querySelectorAll('.grid-item'));
    const minimap = document.getElementById('minimap');
    const minimapPopover = document.getElementById('minimap-popover');
    const logo = document.getElementById('top-left-logo');
    const arrowPopover = document.getElementById('arrow-popover');
    const coordsHUD = document.getElementById('coords-hud');
    const menuToggle = document.getElementById('menu-toggle');
    const topNav = document.getElementById('top-nav');
    const iconMenu = document.getElementById('icon-menu');
    const iconClose = document.getElementById('icon-close');

    // --- State ---
    let currentGridRows = BASE_GRID_ROWS;
    let expandedRow = -1; // -1 means no row is expanded. Stores the index of the parent row.
    let currentVisibleItems = []; // Holds the DOM elements for the visible grid items.

    let currentRow = 1; // Start at (1,1), the first "real" cell in the virtual grid.
    let currentCol = 1;
    let isDragging = false; // True when the user is actively dragging.
    let isTransitioning = false; // True during slide animations to prevent user input.
    let isMenuOpen = false; // True when the off-canvas menu is open.
    let dragAxis = 'none'; // 'horizontal', 'vertical', or 'none'. Locks drag direction.
    let startX = 0; // Initial X position at the start of a drag.
    let startY = 0; // Initial Y position at the start of a drag.
    let currentTranslateX = 0; // The wrapper's current X offset.
    let currentTranslateY = 0; // The wrapper's current Y offset.
    let currentLogoRotation = 0; // The logo's current rotation in degrees.
    let minimapDots = []; // Array to hold the minimap dot DOM elements.
    let hudTimeout = null; // Timer for hiding the HUD.

    // --- Helpers ---

    /**
     * Determines whether to use black or white text based on the brightness of a background color.
     * @param {string} rgb - The RGB background color string (e.g., "rgb(115, 77, 77)").
     * @returns {'#000000' | '#ffffff'} - The contrasting color.
     */
    function getContrastColor(rgb) {
        if (!rgb) return '#ffffff';
        const [r, g, b] = rgb.match(/\d+/g).map(Number);
        // Using the YIQ formula to determine brightness
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 128) ? '#000000' : '#ffffff';
    }

    /**
     * Darkens a hex color by a specified percentage.
     * @param {string} color - The hex color string (e.g., "#RRGGBB").
     * @param {number} percent - The percentage to darken (e.g., 20 for 20%).
     * @returns {string} The new darkened hex color string.
     */
    function shadeColor(color, percent) {
        let R = parseInt(color.substring(1, 3), 16);
        let G = parseInt(color.substring(3, 5), 16);
        let B = parseInt(color.substring(5, 7), 16);

        R = parseInt(R * (100 - percent) / 100);
        G = parseInt(G * (100 - percent) / 100);
        B = parseInt(B * (100 - percent) / 100);

        R = (R < 255) ? R : 255;
        G = (G < 255) ? G : 255;
        B = (B < 255) ? B : 255;

        const RR = ((R.toString(16).length === 1) ? "0" + R.toString(16) : R.toString(16));
        const GG = ((G.toString(16).length === 1) ? "0" + G.toString(16) : G.toString(16));
        const BB = ((B.toString(16).length === 1) ? "0" + B.toString(16) : B.toString(16));

        return "#" + RR + GG + BB;
    }

    // --- Accordion Logic ---

    /**
     * Toggles the sub-page accordion for a given parent row.
     * @param {number} parentRowIndex - The 0-indexed row of the page to expand/collapse.
     */
    function toggleAccordion(parentRowIndex) {
        const currentlyExpanded = expandedRow === parentRowIndex;

        if (expandedRow !== -1) {
            // If any row is expanded, collapse it first.
            expandedRow = -1;
            currentGridRows = BASE_GRID_ROWS;
        }

        if (!currentlyExpanded) {
            // If we are opening a new row (and not just closing an old one).
            expandedRow = parentRowIndex;
            currentGridRows = BASE_GRID_ROWS + 1; // Add one row for sub-pages
        }

        rebuildGrid();
    }

    /**
     * Rebuilds the entire grid DOM and minimap when rows are added or removed.
     */
    function rebuildGrid() {
        currentVisibleItems = [];
        const subPageNames = ['Overview', 'Details', 'Gallery'];
        const pageTitles = { 0: 'DANGER', 1: 'About', 2: 'Services' };
        const pageDescriptions = {
            0: 'A creative powerhouse.',
            1: 'Learn more about us.',
            2: 'What we can do for you.'
        };

        // 1. Generate the list of pages to display (including sub-pages)
        for (let i = 0; i < originalItems.length; i++) {
            const page = originalItems[i];
            
            // Re-create the content for the main page each time
            page.innerHTML = '';
            const heading = document.createElement('h1');
            heading.textContent = pageTitles[i] || `Page ${i + 1}`;
            page.appendChild(heading);

            const description = document.createElement('h2');
            description.textContent = pageDescriptions[i] || `Description for Page ${i + 1}`;
            page.appendChild(description);

            const button = document.createElement('button');
            button.className = 'more-info-btn';
            button.dataset.pageIndex = i;
            button.textContent = '+';
            page.appendChild(button);

            currentVisibleItems.push(page);
            const parentRowIndex = Math.floor(i / BASE_GRID_COLS);

            if (parentRowIndex === expandedRow && (i + 1) % BASE_GRID_COLS === 0) {
                for (let j = 0; j < BASE_GRID_COLS; j++) {
                    const subPage = document.createElement('div');
                    subPage.classList.add('grid-item', 'sub-page');
                    // Background color is now handled by CSS
                    subPage.innerHTML = `<h1>${subPageNames[j] || `Sub Page ${j+1}`}</h1>`;
                    currentVisibleItems.push(subPage);
                }
            }
        }

        // 2. Rebuild the main grid DOM with virtual clones
        wrapper.innerHTML = '';
        const VIRTUAL_GRID_COLS = BASE_GRID_COLS + 2;
        const VIRTUAL_GRID_ROWS = currentGridRows + 2;
        wrapper.style.width = `${VIRTUAL_GRID_COLS * 100}vw`;
        wrapper.style.height = `${VIRTUAL_GRID_ROWS * 100}vh`;
        wrapper.style.gridTemplateColumns = `repeat(${VIRTUAL_GRID_COLS}, 1fr)`;
        wrapper.style.gridTemplateRows = `repeat(${VIRTUAL_GRID_ROWS}, 1fr)`;

        for (let r = 0; r < VIRTUAL_GRID_ROWS; r++) {
            for (let c = 0; c < VIRTUAL_GRID_COLS; c++) {
                const realRow = (r - 1 + currentGridRows) % currentGridRows;
                const realCol = (c - 1 + BASE_GRID_COLS) % BASE_GRID_COLS;
                const itemIndex = realRow * BASE_GRID_COLS + realCol;
                const clone = currentVisibleItems[itemIndex].cloneNode(true);
                wrapper.appendChild(clone);
            }
        }

        // 3. Rebuild the minimap
        minimap.innerHTML = '';
        minimapDots = [];
        minimap.style.gridTemplateColumns = `repeat(${BASE_GRID_COLS}, 1fr)`;

        // Popover logic needs to be managed here since the minimap is cleared.
        const defaultPopoverBg = getComputedStyle(minimapPopover).getPropertyValue('background-color');
        const defaultPopoverColor = getComputedStyle(minimapPopover).getPropertyValue('color');
        minimap.addEventListener('mouseleave', () => {
            minimapPopover.classList.remove('visible');
            minimapPopover.style.backgroundColor = defaultPopoverBg;
            minimapPopover.style.color = defaultPopoverColor;
            minimapPopover.style.setProperty('--popover-bg', defaultPopoverBg);
        });

        for (let r = 0; r < currentGridRows; r++) {
            for (let c = 0; c < BASE_GRID_COLS; c++) {
                const dot = document.createElement('div');
                dot.classList.add('minimap-dot');
                dot.dataset.row = r;
                dot.dataset.col = c;

                // Check if this dot corresponds to a sub-page
                const itemIndex = r * BASE_GRID_COLS + c;
                if (currentVisibleItems[itemIndex].classList.contains('sub-page')) {
                    dot.classList.add('sub-page-dot');
                }

                dot.addEventListener('click', () => moveTo(r, c));

                dot.addEventListener('mouseenter', () => {
                    const itemIndex = r * BASE_GRID_COLS + c;
                    const targetCell = currentVisibleItems[itemIndex];
                    if (!targetCell) return;

                    const bgColor = window.getComputedStyle(targetCell).backgroundColor;
                    const textColor = getContrastColor(bgColor);
                    
                    minimapPopover.textContent = targetCell.querySelector('h1').textContent;
                    minimapPopover.style.backgroundColor = bgColor;
                    minimapPopover.style.color = textColor;
                    minimapPopover.style.setProperty('--popover-bg', bgColor);
                    minimapPopover.classList.add('visible');
                });

                minimap.appendChild(dot);
                minimapDots.push(dot);
            }
        }
        
        // 4. Re-attach accordion button listeners
        document.querySelectorAll('.more-info-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const pageIndex = parseInt(e.currentTarget.dataset.pageIndex, 10);
                const parentRowIndex = Math.floor(pageIndex / BASE_GRID_COLS);
                toggleAccordion(parentRowIndex);
            });
        });

        updatePosition(false);
        updateMinimap();
        showHudTemporarily();
    }

    // --- Core Logic ---

    /**
     * Moves the grid wrapper to the current cell.
     * @param {boolean} animate - If true, the transition will be animated.
     */
    function updatePosition(animate = false) {
        if (animate) {
            isTransitioning = true;
            wrapper.style.transition = `transform ${TRANSITION_DURATION_MS}ms cubic-bezier(0.77,0,0.175,1)`;
            // After the transition, check if we need to "teleport" for infinite scroll.
            setTimeout(checkForTeleport, TRANSITION_DURATION_MS);
        } else {
            wrapper.style.transition = 'none';
        }

        currentTranslateX = -currentCol * window.innerWidth;
        currentTranslateY = -currentRow * window.innerHeight;

        wrapper.style.transform = `translate(${currentTranslateX}px, ${currentTranslateY}px)`;
        updateMinimap();
        updateCoordsHUD();
        showHudTemporarily();
    }

    /**
     * After moving to a cloned cell, instantly jump back to the corresponding
     * real cell on the opposite side to maintain the infinite illusion.
     */
    function checkForTeleport() {
        isTransitioning = false;
        let teleported = false;

        if (currentRow === 0) { // Moved to top cloned row
            currentRow = currentGridRows;
            teleported = true;
        } else if (currentRow === VIRTUAL_GRID_ROWS - 1) { // Moved to bottom cloned row
            currentRow = 1;
            teleported = true;
        }

        if (currentCol === 0) { // Moved to left cloned col
            currentCol = BASE_GRID_COLS;
            teleported = true;
        } else if (currentCol === VIRTUAL_GRID_COLS - 1) { // Moved to right cloned col
            currentCol = 1;
            teleported = true;
        }

        if (teleported) {
            updatePosition(false); // Jump without animation
        }
    }

    /**
     * Calculates the shortest path to a target cell and moves the grid there.
     * This allows for wrapping around the grid.
     * @param {number} targetRealRow - The destination row (0-indexed).
     * @param {number} targetRealCol - The destination column (0-indexed).
     */
    function moveTo(targetRealRow, targetRealCol) {
        if (isTransitioning || isMenuOpen) return;

        const currentRealRow = (currentRow - 1 + currentGridRows) % currentGridRows;
        const currentRealCol = (currentCol - 1 + BASE_GRID_COLS) % BASE_GRID_COLS;

        let deltaRow = targetRealRow - currentRealRow;
        let deltaCol = targetRealCol - currentRealCol;

        // Check if wrapping around would be a shorter path.
        if (Math.abs(deltaRow) > currentGridRows / 2) {
            deltaRow = deltaRow > 0 ? deltaRow - currentGridRows : deltaRow + currentGridRows;
        }
        if (Math.abs(deltaCol) > BASE_GRID_COLS / 2) {
            deltaCol = deltaCol > 0 ? deltaCol - BASE_GRID_COLS : deltaCol + BASE_GRID_COLS;
        }

        if (deltaRow === 0 && deltaCol === 0) return;

        // Trigger logo animation based on movement direction.
        if (deltaCol !== 0) { // Prioritize horizontal animation
            animateLogo(deltaCol > 0 ? 'cw' : 'ccw');
        } else if (deltaRow !== 0) {
            animateLogo(deltaRow > 0 ? 'cw' : 'ccw');
        }

        currentRow += deltaRow;
        currentCol += deltaCol;

        updatePosition(true);
    }

    // --- UI & Animations ---

    /**
     * Populates the grid wrapper with a larger virtual grid, cloning the original
     * items to create buffer cells on each side for the infinite scroll effect.
     */
    function setupInfiniteGrid() {
        // This function is now effectively replaced by rebuildGrid
    }

    /**
     * Creates the minimap dots and sets up their event listeners.
     */
    function setupMinimap() {
        // This function is now effectively replaced by rebuildGrid
    }

    /**
     * Updates the active state of the minimap dots.
     */
    function updateMinimap() {
        // Calculate the "real" grid position, ignoring the cloned buffer cells.
        const realRow = (currentRow - 1 + currentGridRows) % currentGridRows;
        const realCol = (currentCol - 1 + BASE_GRID_COLS) % BASE_GRID_COLS;
        const activeIndex = realRow * BASE_GRID_COLS + realCol;

        minimapDots.forEach((dot, index) => {
            dot.classList.toggle('active', index === activeIndex);
        });
    }

    /**
     * Shows the HUD for a couple of seconds, then fades it out.
     */
    function showHudTemporarily() {
        clearTimeout(hudTimeout);
        coordsHUD.classList.add('visible');
        hudTimeout = setTimeout(() => {
            coordsHUD.classList.remove('visible');
        }, 2000);
    }

    /**
     * Updates the coordinates display on the HUD.
     */
    function updateCoordsHUD() {
        const realRow = (currentRow - 1 + currentGridRows) % currentGridRows;
        const realCol = (currentCol - 1 + BASE_GRID_COLS) % BASE_GRID_COLS;
        const itemIndex = realRow * BASE_GRID_COLS + realCol;
        
        if (itemIndex < 0 || itemIndex >= currentVisibleItems.length) return;

        const currentItem = currentVisibleItems[itemIndex];
        let title = currentItem.querySelector('h1')?.textContent || `Page ${itemIndex + 1}`;
        
        // Check if the current item is a sub-page and create a breadcrumb.
        if (expandedRow !== -1 && currentItem.classList.contains('sub-page')) {
            // The parent page is in the expanded row, at the same column.
            const parentItemIndex = expandedRow * BASE_GRID_COLS + realCol;
            if (parentItemIndex < currentVisibleItems.length) {
                const parentItem = currentVisibleItems[parentItemIndex];
                const parentTitle = parentItem.querySelector('h1')?.textContent || '';
                if (parentTitle) {
                    const subPageTitle = title;
                    title = `${parentTitle} / ${subPageTitle}`;
                }
            }
        }

        const pageIconSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;
        // Display 1-based coordinates for a more user-friendly format.
        coordsHUD.innerHTML = `${pageIconSVG} ${title} | (${realRow + 1}, ${realCol + 1})`;
    }

    /**
     * Animates the logo by applying a CSS rotation.
     * @param {'cw' | 'ccw'} direction - The direction to spin the logo.
     */
    function animateLogo(direction) {
        logo.style.transition = 'transform 0.5s ease-in-out';
        const newRotation = currentLogoRotation + (direction === 'cw' ? 360 : -360);
        logo.style.transform = `rotate(${newRotation}deg)`;
        currentLogoRotation = newRotation;
    }

    /**
     * Sets up the navigation arrow buttons, including their click and hover events for popovers.
     */
    function setupArrowButtons() {
        const arrows = [
            { id: 'arrow-up', text: 'Up', pos: 'bottom', action: () => { currentRow--; animateLogo('ccw'); } },
            { id: 'arrow-down', text: 'Down', pos: 'top', action: () => { currentRow++; animateLogo('cw'); } },
            { id: 'arrow-left', text: 'Left', pos: 'right', action: () => { currentCol--; animateLogo('ccw'); } },
            { id: 'arrow-right', text: 'Right', pos: 'left', action: () => { currentCol++; animateLogo('cw'); } }
        ];

        arrows.forEach(arrowData => {
            const button = document.getElementById(arrowData.id);

            button.addEventListener('mouseenter', () => {
                const rect = button.getBoundingClientRect();
                arrowPopover.textContent = arrowData.text;
                arrowPopover.dataset.position = arrowData.pos;
                arrowPopover.classList.add('visible');

                // Position the popover dynamically based on the arrow's location.
                switch (arrowData.pos) {
                    case 'bottom':
                        arrowPopover.style.top = `${rect.bottom + POPOVER_OFFSET_PX}px`;
                        arrowPopover.style.left = `${rect.left + rect.width / 2 - arrowPopover.offsetWidth / 2}px`;
                        break;
                    case 'top':
                        arrowPopover.style.top = `${rect.top - arrowPopover.offsetHeight - POPOVER_OFFSET_PX}px`;
                        arrowPopover.style.left = `${rect.left + rect.width / 2 - arrowPopover.offsetWidth / 2}px`;
                        break;
                    case 'right':
                        arrowPopover.style.top = `${rect.top + rect.height / 2 - arrowPopover.offsetHeight / 2}px`;
                        arrowPopover.style.left = `${rect.right + POPOVER_OFFSET_PX}px`;
                        break;
                    case 'left':
                        arrowPopover.style.top = `${rect.top + rect.height / 2 - arrowPopover.offsetHeight / 2}px`;
                        arrowPopover.style.left = `${rect.left - arrowPopover.offsetWidth - POPOVER_OFFSET_PX}px`;
                        break;
                }
            });

            button.addEventListener('mouseleave', () => {
                arrowPopover.classList.remove('visible');
            });

            button.addEventListener('click', () => {
                if (isTransitioning) return;
                arrowData.action();
                updatePosition(true);
            });
        });
    }

    /**
     * Shows and hides navigation arrows when the mouse is near the screen edges.
     */
    function setupEdgeDetection() {
        const arrows = {
            up: document.getElementById('arrow-up'),
            down: document.getElementById('arrow-down'),
            left: document.getElementById('arrow-left'),
            right: document.getElementById('arrow-right')
        };

        document.addEventListener('mousemove', (e) => {
            const nearTop = e.clientY < EDGE_DETECTION_THRESHOLD_PX;
            const nearBottom = window.innerHeight - e.clientY < EDGE_DETECTION_THRESHOLD_PX;
            const nearLeft = e.clientX < EDGE_DETECTION_THRESHOLD_PX;
            const nearRight = window.innerWidth - e.clientX < EDGE_DETECTION_THRESHOLD_PX;

            arrows.up.classList.toggle('visible', nearTop && !nearLeft && !nearRight);
            arrows.down.classList.toggle('visible', nearBottom && !nearLeft && !nearRight);
            arrows.left.classList.toggle('visible', nearLeft && !nearTop && !nearBottom);
            arrows.right.classList.toggle('visible', nearRight && !nearTop && !nearBottom);

            const inTopRightCorner = nearTop && nearRight;
            menuToggle.classList.toggle('visible', inTopRightCorner);
        });

        // Hide all arrows when the mouse leaves the window.
        document.body.addEventListener('mouseleave', () => {
            Object.values(arrows).forEach(arrow => arrow.classList.remove('visible'));
            menuToggle.classList.remove('visible');
        });
    }


    // --- Event Handlers ---

    /**
     * Initializes a drag operation.
     * @param {number} x - The starting clientX position.
     * @param {number} y - The starting clientY position.
     */
    function handleDragStart(x, y) {
        if (isTransitioning || isMenuOpen) return;
        isDragging = true;
        startX = x;
        startY = y;
        dragAxis = 'none'; // Reset axis lock
        container.style.cursor = 'grabbing';
        wrapper.style.transition = 'none';
        logo.style.transition = 'none';
        
        clearTimeout(hudTimeout);
        coordsHUD.classList.add('visible');

        // Store the starting translation
        currentTranslateX = -currentCol * window.innerWidth;
        currentTranslateY = -currentRow * window.innerHeight;
    }

    /**
     * Handles the dragging movement, updating the grid and logo positions in real-time.
     * @param {number} x - The current clientX position.
     * @param {number} y - The current clientY position.
     */
    function handleDragMove(x, y) {
        if (!isDragging) return;

        const deltaX = x - startX;
        const deltaY = y - startY;

        // Lock the drag axis after a small movement to prevent diagonal dragging.
        if (dragAxis === 'none') {
            if (Math.abs(deltaX) > AXIS_LOCK_THRESHOLD_PX || Math.abs(deltaY) > AXIS_LOCK_THRESHOLD_PX) {
                dragAxis = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical';
            }
        }

        // Move the grid and rotate the logo based on the locked axis.
        if (dragAxis === 'horizontal') {
            const rotation = (deltaX / window.innerWidth) * -180; // Inverted for natural feel
            logo.style.transform = `rotate(${currentLogoRotation + rotation}deg)`;
            wrapper.style.transform = `translate(${currentTranslateX + deltaX}px, ${currentTranslateY}px)`;
        } else if (dragAxis === 'vertical') {
            const rotation = (deltaY / window.innerHeight) * -180; // Inverted for natural feel
            logo.style.transform = `rotate(${currentLogoRotation + rotation}deg)`;
            wrapper.style.transform = `translate(${currentTranslateX}px, ${currentTranslateY + deltaY}px)`;
        }
    }

    /**
     * Finalizes the drag operation, snapping to the new cell or back to the original.
     * @param {number} x - The final clientX position.
     * @param {number} y - The final clientY position.
     */
    function handleDragEnd(x, y) {
        if (!isDragging) return;
        isDragging = false;
        container.style.cursor = 'grab';

        const thresholdX = window.innerWidth / DRAG_THRESHOLD_DIVISOR;
        const thresholdY = window.innerHeight / DRAG_THRESHOLD_DIVISOR;
        let moved = false;

        // Determine if the drag distance crossed the threshold to change cells.
        if (dragAxis === 'horizontal') {
            const deltaX = x - startX;
            if (deltaX < -thresholdX) { // Dragged right
                currentCol++;
                animateLogo('cw');
                moved = true;
            } else if (deltaX > thresholdX) { // Dragged left
                currentCol--;
                animateLogo('ccw');
                moved = true;
            }
        } else if (dragAxis === 'vertical') {
            const deltaY = y - startY;
            if (deltaY < -thresholdY) { // Dragged down
                currentRow++;
                animateLogo('cw');
                moved = true;
            } else if (deltaY > thresholdY) { // Dragged up
                currentRow--;
                animateLogo('ccw');
                moved = true;
            }
        }

        // If the threshold wasn't crossed, snap back to the starting position.
        if (!moved) {
            logo.style.transition = 'transform 0.4s cubic-bezier(0.77,0,0.175,1)';
            logo.style.transform = `rotate(${currentLogoRotation}deg)`;
        }

        // Animate the grid to its final position.
        updatePosition(true);
    }

    /**
     * Handles keyboard navigation with arrow keys.
     * @param {KeyboardEvent} e - The keyboard event.
     */
    function handleKeyDown(e) {
        if (isTransitioning || isMenuOpen) return;

        let newRow = currentRow;
        let newCol = currentCol;

        switch (e.key) {
            case 'ArrowUp': newRow--; animateLogo('ccw'); break;
            case 'ArrowDown': newRow++; animateLogo('cw'); break;
            case 'ArrowLeft': newCol--; animateLogo('ccw'); break;
            case 'ArrowRight': newCol++; animateLogo('cw'); break;
            default: return; // Ignore other keys
        }

        // Wrap around logic using the current grid dimensions
        const realRow = (newRow - 1 + currentGridRows) % currentGridRows;
        const realCol = (newCol - 1 + BASE_GRID_COLS) % BASE_GRID_COLS;

        currentRow = realRow + 1;
        currentCol = realCol + 1;

        updatePosition(true);
    }

    /**
     * Handles navigation with the mouse scroll wheel, moving sequentially through cells.
     * @param {WheelEvent} e - The wheel event.
     */
    function handleWheel(e) {
        if (isTransitioning || isMenuOpen) return;
        e.preventDefault(); // Prevent page scrolling

        // Calculate current linear index from the real grid position
        const realRow = (currentRow - 1 + currentGridRows) % currentGridRows;
        const realCol = (currentCol - 1 + BASE_GRID_COLS) % BASE_GRID_COLS;
        const currentIndex = realRow * BASE_GRID_COLS + realCol;
        const totalCells = currentGridRows * BASE_GRID_COLS;

        let nextIndex;

        // Determine next index based on scroll direction
        if (e.deltaY > 10) { // Scroll down
            nextIndex = (currentIndex + 1) % totalCells;
        } else if (e.deltaY < -10) { // Scroll up
            nextIndex = (currentIndex - 1 + totalCells) % totalCells;
        } else {
            return; // No significant vertical scroll
        }

        // Convert linear index back to row/col
        const nextRealRow = Math.floor(nextIndex / BASE_GRID_COLS);
        const nextRealCol = nextIndex % BASE_GRID_COLS;

        // Use moveTo to handle the navigation
        moveTo(nextRealRow, nextRealCol);
    }

    /**
     * Toggles the off-canvas menu visibility.
     * @param {boolean} open - True to open the menu, false to close.
     */
    function toggleMenu(open) {
        isMenuOpen = open;
        topNav.classList.toggle('is-open', open);
        iconMenu.style.display = open ? 'none' : 'block';
        iconClose.style.display = open ? 'block' : 'none';
    }

    // --- Initialization ---

    // Set up menu listeners
    menuToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMenu(!isMenuOpen);
    });

    document.addEventListener('click', (e) => {
        // Close menu if clicking outside of it and not on the toggle button
        if (isMenuOpen && !topNav.contains(e.target) && e.target !== menuToggle) {
            toggleMenu(false);
        }
    });

    // Set up mouse event listeners
    container.addEventListener('mousedown', (e) => handleDragStart(e.clientX, e.clientY));
    window.addEventListener('mousemove', (e) => handleDragMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', (e) => handleDragEnd(e.clientX, e.clientY));

    // Set up touch event listeners
    container.addEventListener('touchstart', (e) => handleDragStart(e.touches[0].clientX, e.touches[0].clientY), { passive: false });
    window.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });
    window.addEventListener('touchend', (e) => handleDragEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY));

    // Set up keyboard and wheel listeners
    window.addEventListener('keydown', handleKeyDown);
    container.addEventListener('wheel', handleWheel, { passive: false });

    // Initial page setup
    container.style.cursor = 'grab';
    rebuildGrid(); // Initial build
    setupArrowButtons();
    setupEdgeDetection();
    showHudTemporarily();
    // updatePosition(); // Called inside rebuildGrid
});

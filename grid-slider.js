document.addEventListener('DOMContentLoaded', () => {
    const wrapper = document.getElementById('grid-wrapper');
    const container = document.getElementById('grid-container');
    const originalItems = Array.from(wrapper.querySelectorAll('.grid-item'));
    const minimap = document.getElementById('minimap');
    const popover = document.getElementById('minimap-popover');
    const logo = document.getElementById('top-left-logo');
    let minimapDots = [];

    const GRID_COLS = 3;
    const GRID_ROWS = 3;

    // A buffer of 1 cell on each side for the infinite illusion
    const VIRTUAL_GRID_COLS = GRID_COLS + 2;
    const VIRTUAL_GRID_ROWS = GRID_ROWS + 2;

    // Position is tracked within the larger virtual grid
    let currentRow = 1; // Start at the first "real" item
    let currentCol = 1;

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let currentTranslateX = 0;
    let currentTranslateY = 0;

    let isTransitioning = false;
    const TRANSITION_DURATION = 400; // ms

    let dragAxis = 'none';
    const AXIS_LOCK_THRESHOLD = 1;
    let currentLogoRotation = 0;

    function setupMinimap() {
        minimap.addEventListener('mouseleave', () => {
            popover.classList.remove('visible');
        });

        for (let r = 0; r < GRID_ROWS; r++) {
            for (let c = 0; c < GRID_COLS; c++) {
                const dot = document.createElement('div');
                dot.classList.add('minimap-dot');
                dot.dataset.row = r;
                dot.dataset.col = c;
                
                dot.addEventListener('mouseenter', () => {
                    popover.textContent = `Cell (${r + 1}, ${c + 1})`;
                    popover.classList.add('visible');
                });

                dot.addEventListener('click', () => {
                    const targetRow = parseInt(dot.dataset.row);
                    const targetCol = parseInt(dot.dataset.col);
                    moveTo(targetRow, targetCol);
                });

                minimap.appendChild(dot);
                minimapDots.push(dot);
            }
        }
    }

    function updateMinimap() {
        // Calculate the "real" grid position, ignoring the cloned buffer cells
        const realRow = (currentRow - 1 + GRID_ROWS) % GRID_ROWS;
        const realCol = (currentCol - 1 + GRID_COLS) % GRID_COLS;
        const activeIndex = realRow * GRID_COLS + realCol;

        minimapDots.forEach((dot, index) => {
            dot.classList.toggle('active', index === activeIndex);
        });
    }

    function moveTo(targetRealRow, targetRealCol) {
        if (isTransitioning) return;

        const currentRealRow = (currentRow - 1 + GRID_ROWS) % GRID_ROWS;
        const currentRealCol = (currentCol - 1 + GRID_COLS) % GRID_COLS;

        let deltaRow = targetRealRow - currentRealRow;
        let deltaCol = targetRealCol - currentRealCol;

        // Find the shortest path, including wrapping around
        if (Math.abs(deltaRow) > GRID_ROWS / 2) {
            deltaRow = deltaRow > 0 ? deltaRow - GRID_ROWS : deltaRow + GRID_ROWS;
        }
        if (Math.abs(deltaCol) > GRID_COLS / 2) {
            deltaCol = deltaCol > 0 ? deltaCol - GRID_COLS : deltaCol + GRID_COLS;
        }

        if (deltaRow === 0 && deltaCol === 0) return;
        
        if (deltaCol !== 0) { // Prioritize horizontal animation direction
            animateLogo(deltaCol > 0 ? 'cw' : 'ccw');
        } else if (deltaRow !== 0) {
            animateLogo(deltaRow > 0 ? 'cw' : 'ccw');
        }

        currentRow += deltaRow;
        currentCol += deltaCol;
        
        updatePosition(true);
    }

    function setupInfiniteGrid() {
        wrapper.innerHTML = ''; // Clear original static items
        wrapper.style.width = `${VIRTUAL_GRID_COLS * 100}vw`;
        wrapper.style.height = `${VIRTUAL_GRID_ROWS * 100}vh`;
        wrapper.style.gridTemplateColumns = `repeat(${VIRTUAL_GRID_COLS}, 1fr)`;
        wrapper.style.gridTemplateRows = `repeat(${VIRTUAL_GRID_ROWS}, 1fr)`;

        for (let r = 0; r < VIRTUAL_GRID_ROWS; r++) {
            for (let c = 0; c < VIRTUAL_GRID_COLS; c++) {
                const originalRow = (r - 1 + GRID_ROWS) % GRID_ROWS;
                const originalCol = (c - 1 + GRID_COLS) % GRID_COLS;
                const originalIndex = originalRow * GRID_COLS + originalCol;

                const clone = originalItems[originalIndex].cloneNode(true);
                wrapper.appendChild(clone);
            }
        }
    }

    function checkForTeleport() {
        isTransitioning = false;
        let teleported = false;
        
        if (currentRow === 0) { // Top clone row
            currentRow = GRID_ROWS;
            teleported = true;
        } else if (currentRow === VIRTUAL_GRID_ROWS - 1) { // Bottom clone row
            currentRow = 1;
            teleported = true;
        }
        
        if (currentCol === 0) { // Left clone col
            currentCol = GRID_COLS;
            teleported = true;
        } else if (currentCol === VIRTUAL_GRID_COLS - 1) { // Right clone col
            currentCol = 1;
            teleported = true;
        }

        if (teleported) {
            updatePosition(false);
        }
    }
    
    function updatePosition(animate = false) {
        if (animate) {
            isTransitioning = true;
            wrapper.style.transition = `transform ${TRANSITION_DURATION}ms cubic-bezier(0.77,0,0.175,1)`;
            setTimeout(checkForTeleport, TRANSITION_DURATION);
        } else {
            wrapper.style.transition = 'none';
        }
        
        currentTranslateX = -currentCol * window.innerWidth;
        currentTranslateY = -currentRow * window.innerHeight;

        wrapper.style.transform = `translate(${currentTranslateX}px, ${currentTranslateY}px)`;
        updateMinimap();
    }

    function animateLogo(direction) { // 'cw' or 'ccw'
        logo.style.transition = 'transform 0.5s ease-in-out';
        const newRotation = currentLogoRotation + (direction === 'cw' ? 360 : -360);
        logo.style.transform = `rotate(${newRotation}deg)`;
        currentLogoRotation = newRotation;
    }

    function handleDragStart(x, y) {
        if (isTransitioning) return;
        isDragging = true;
        startX = x;
        startY = y;
        dragAxis = 'none';
        container.style.cursor = 'grabbing';
        wrapper.style.transition = 'none';
        logo.style.transition = 'none';
        currentTranslateX = -currentCol * window.innerWidth;
        currentTranslateY = -currentRow * window.innerHeight;
    }
    
    function handleDragMove(x, y) {
        if (!isDragging) return;

        const deltaX = x - startX;
        const deltaY = y - startY;
        
        if (dragAxis === 'none') {
            if (Math.abs(deltaX) > AXIS_LOCK_THRESHOLD || Math.abs(deltaY) > AXIS_LOCK_THRESHOLD) {
                dragAxis = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical';
            }
        }
        
        if (dragAxis === 'horizontal') {
            const rotation = (deltaX / window.innerWidth) * -180; // Inverted
            logo.style.transform = `rotate(${currentLogoRotation + rotation}deg)`;
            wrapper.style.transform = `translate(${currentTranslateX + deltaX}px, ${currentTranslateY}px)`;
        } else if (dragAxis === 'vertical') {
            const rotation = (deltaY / window.innerHeight) * -180; // Inverted
            logo.style.transform = `rotate(${currentLogoRotation + rotation}deg)`;
            wrapper.style.transform = `translate(${currentTranslateX}px, ${currentTranslateY + deltaY}px)`;
        }
    }

    function handleDragEnd(x, y) {
        if (!isDragging) return;
        isDragging = false;
        container.style.cursor = 'grab';

        const deltaX = x - startX;
        const deltaY = y - startY;

        const thresholdX = window.innerWidth / 8;
        const thresholdY = window.innerHeight / 8;
        let moved = false;

        if (dragAxis === 'horizontal') {
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
        
        if (!moved) {
            // If not moved, snap logo back
            logo.style.transition = 'transform 0.4s cubic-bezier(0.77,0,0.175,1)';
            logo.style.transform = `rotate(${currentLogoRotation}deg)`;
        }
        
        updatePosition(true);
    }
    
    function handleKeyDown(e) {
        if (isTransitioning) return;
        
        switch (e.key) {
            case 'ArrowUp': currentRow--; animateLogo('ccw'); break;
            case 'ArrowDown': currentRow++; animateLogo('cw'); break;
            case 'ArrowLeft': currentCol--; animateLogo('ccw'); break;
            case 'ArrowRight': currentCol++; animateLogo('cw'); break;
            default: return;
        }

        updatePosition(true);
    }

    function handleWheel(e) {
        if (isTransitioning) return;
        e.preventDefault();
        
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
            if (e.deltaY > 10) {
                currentRow++;
                animateLogo('cw');
            } else if (e.deltaY < -10) {
                currentRow--;
                animateLogo('ccw');
            }
        } else {
            if (e.deltaX > 10) {
                currentCol++;
                animateLogo('cw');
            } else if (e.deltaX < -10) {
                currentCol--;
                animateLogo('ccw');
            }
        }
        
        updatePosition(true);
    }
    
    // --- Arrow Button Click Handlers ---
    function setupArrowButtons() {
        const arrowPopover = document.getElementById('arrow-popover');
        const POPOVER_OFFSET = 15;

        const arrows = [
            { id: 'arrow-up', text: 'Up', position: 'bottom', action: () => { currentRow--; animateLogo('ccw'); } },
            { id: 'arrow-down', text: 'Down', position: 'top', action: () => { currentRow++; animateLogo('cw'); } },
            { id: 'arrow-left', text: 'Left', position: 'right', action: () => { currentCol--; animateLogo('ccw'); } },
            { id: 'arrow-right', text: 'Right', position: 'left', action: () => { currentCol++; animateLogo('cw'); } }
        ];

        arrows.forEach(arrowData => {
            const button = document.getElementById(arrowData.id);
            
            button.addEventListener('mouseenter', () => {
                const rect = button.getBoundingClientRect();
                arrowPopover.textContent = arrowData.text;
                arrowPopover.dataset.position = arrowData.position;
                arrowPopover.classList.add('visible');

                switch (arrowData.position) {
                    case 'bottom':
                        arrowPopover.style.top = `${rect.bottom + POPOVER_OFFSET}px`;
                        arrowPopover.style.left = `${rect.left + rect.width / 2 - arrowPopover.offsetWidth / 2}px`;
                        break;
                    case 'top':
                        arrowPopover.style.top = `${rect.top - arrowPopover.offsetHeight - POPOVER_OFFSET}px`;
                        arrowPopover.style.left = `${rect.left + rect.width / 2 - arrowPopover.offsetWidth / 2}px`;
                        break;
                    case 'right':
                        arrowPopover.style.top = `${rect.top + rect.height / 2 - arrowPopover.offsetHeight / 2}px`;
                        arrowPopover.style.left = `${rect.right + POPOVER_OFFSET}px`;
                        break;
                    case 'left':
                        arrowPopover.style.top = `${rect.top + rect.height / 2 - arrowPopover.offsetHeight / 2}px`;
                        arrowPopover.style.left = `${rect.left - arrowPopover.offsetWidth - POPOVER_OFFSET}px`;
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

    function setupEdgeDetection() {
        const edgeThreshold = 100; // pixels from the edge
        const arrows = {
            up: document.getElementById('arrow-up'),
            down: document.getElementById('arrow-down'),
            left: document.getElementById('arrow-left'),
            right: document.getElementById('arrow-right')
        };

        document.addEventListener('mousemove', (e) => {
            arrows.up.classList.toggle('visible', e.clientY < edgeThreshold);
            arrows.down.classList.toggle('visible', window.innerHeight - e.clientY < edgeThreshold);
            arrows.left.classList.toggle('visible', e.clientX < edgeThreshold);
            arrows.right.classList.toggle('visible', window.innerWidth - e.clientX < edgeThreshold);
        });

        document.body.addEventListener('mouseleave', () => {
            Object.values(arrows).forEach(arrow => arrow.classList.remove('visible'));
        });
    }

    // Mouse events
    container.addEventListener('mousedown', (e) => handleDragStart(e.clientX, e.clientY));
    window.addEventListener('mousemove', (e) => handleDragMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', (e) => handleDragEnd(e.clientX, e.clientY));
    
    // Touch events
    container.addEventListener('touchstart', (e) => handleDragStart(e.touches[0].clientX, e.touches[0].clientY), { passive: false });
    window.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });
    window.addEventListener('touchend', (e) => handleDragEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY));
    
    // Keyboard and Wheel events
    window.addEventListener('keydown', handleKeyDown);
    container.addEventListener('wheel', handleWheel, { passive: false });

    // Initial setup
    container.style.cursor = 'grab';
    setupInfiniteGrid();
    setupMinimap();
    setupArrowButtons();
    setupEdgeDetection();
    updatePosition();
});

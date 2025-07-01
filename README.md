# WWWUI

A modern, lightweight full-page scrolling framework with advanced navigation features.

```
██╗    ██╗██╗    ██╗██╗    ██╗██╗   ██╗██╗
██║    ██║██║    ██║██║    ██║██║   ██║██║
██║ █╗ ██║██║ █╗ ██║██║ █╗ ██║██║   ██║██║
██║███╗██║██║███╗██║██║███╗██║██║   ██║██║
╚███╔███╔╝╚███╔███╔╝╚███╔███╔╝╚██████╔╝██║
 ╚══╝╚══╝  ╚══╝╚══╝  ╚══╝╚══╝  ╚═════╝ ╚═╝                                    
```

## Features

- **Smooth Full-Page Scrolling**: Navigate through sections with fluid animations
- **Horizontal Slide Support**: Each section can contain multiple horizontal slides
- **Multiple Navigation Methods**:
  - Mouse wheel scrolling
  - Keyboard arrows (↑/↓ for sections, ←/→ for slides)
  - Touch gestures on mobile
  - Mouse drag-to-scroll on desktop
  - Click navigation via minimap
- **Interactive Minimap**: Visual navigation control with section/slide selection
- **Auto-scroll Playlist**: Create custom auto-play sequences through selected slides
- **Responsive Design**: Optimized for both desktop and mobile devices
- **Infinite Scroll Loop**: Seamlessly cycle through content

## Installation

1. Include the required files in your HTML:

```html
<link rel="stylesheet" href="style.css">
<script src="https://unpkg.com/lucide@latest"></script>
<script src="wwwui.js"></script>
```

2. Set up your HTML structure:

```html
<div id="fullpage-root">
  <!-- Section with slides -->
  <section class="fp-section">
    <div class="fp-slides">
      <div class="fp-slide">
        <h1 class="section-title">Slide 1</h1>
        <p>Content here</p>
      </div>
      <div class="fp-slide">
        <h1 class="section-title">Slide 2</h1>
        <p>Content here</p>
      </div>
      <!-- Navigation buttons (optional) -->
      <button data-slide-prev>Previous</button>
      <button data-slide-next>Next</button>
    </div>
  </section>
  
  <!-- More sections... -->
</section>

<!-- Minimap container (optional) -->
<div id="minimap"></div>
```

3. Initialize WWWUI:

```javascript
wwwui.init({
  root: '#fullpage-root',
  minimap: '#minimap',
  autoScroll: true,
  autoScrollDelay: 5000
});
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `root` | string | `'#fullpage-root'` | Selector for the main container |
| `minimap` | string | `null` | Selector for the minimap container |
| `autoScroll` | boolean | `false` | Enable auto-scrolling through selected slides |
| `autoScrollDelay` | number | `5000` | Delay between auto-scroll transitions (ms) |
| `easing` | string | `'cubic-bezier(0.77,0,0.175,1)'` | CSS easing function for animations |
| `onSectionEnter` | function | `null` | Callback when entering a section |
| `onSectionLeave` | function | `null` | Callback when leaving a section |

## API Methods

### `wwwui.init(options)`
Initialize the framework with configuration options.

### `wwwui.moveTo(sectionIndex, slideIndex?, direction?)`
Programmatically navigate to a specific section and optionally a slide.
- `sectionIndex`: Target section (0-based)
- `slideIndex`: Target slide within section (optional)
- `direction`: Animation direction ('up' or 'down')

### `wwwui.moveUp()`
Navigate to the previous element (slide or section).

### `wwwui.moveDown()`
Navigate to the next element (slide or section).

## Minimap Usage

The minimap provides visual navigation and slide selection controls:

- **Click section icons** (squares on the left) to jump to sections
- **Click slide icons** to navigate and toggle slide selection
- **Selected slides** (highlighted) are included in auto-scroll playlist
- **Deselected slides** are skipped during navigation
- **Hover** for tooltips showing section/slide titles

## Styling

The framework uses data attributes for styling active elements:

```css
/* Style active sections */
.fp-section[data-active="true"] {
  /* Your styles */
}

/* Style active slides */
.fp-slide[data-active="true"] {
  /* Your styles */
}

/* Style selected minimap items */
.minimap-slide[data-selected="true"] {
  /* Your styles */
}
```

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers with touch support

## License

MIT License - see LICENSE file for details

## Examples

### Basic Setup
```javascript
// Simple initialization
wwwui.init();
```

### With Callbacks
```javascript
wwwui.init({
  onSectionEnter: (index) => {
    console.log(`Entered section ${index}`);
  },
  onSectionLeave: (index) => {
    console.log(`Left section ${index}`);
  }
});
```

### Custom Auto-scroll
```javascript
// Initialize with auto-scroll
wwwui.init({
  autoScroll: true,
  autoScrollDelay: 3000,
  minimap: '#minimap'
});

// Use minimap to create custom playlist by clicking slides
```

## Tips

- Add `class="section-title"` to elements for minimap tooltips
- Auto-scroll automatically disables on user interaction
- Drag gestures support free-form scrolling with snap-to-nearest
- The framework automatically handles infinite looping in both directions 
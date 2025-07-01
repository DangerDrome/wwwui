// Demo: initialize framework
document.addEventListener('DOMContentLoaded', function() {
  // Lucide icons init
  lucide.createIcons();
  
  // Initialize the framework
  wwwui.init({
    root: '#fullpage-root',
    minimap: '#fp-minimap',
    autoScroll: true,
    autoScrollDelay: 4000,
    easing: 'cubic-bezier(0.77,0,0.175,1)',
    onSectionEnter: function(index) {
      console.log('Entered section:', index);
    },
    onSectionLeave: function(index) {
      console.log('Left section:', index);
    }
  });
}); 
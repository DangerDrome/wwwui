// Demo: initialize framework
window.addEventListener('DOMContentLoaded', () => {
  // Lucide icons init
  lucide.createIcons();
  
  // Initialize the framework
  window.fullpageFramework.init({
    root: '#fullpage-root',
    navDots: '#fp-nav-dots',
    autoScroll: true,
    autoScrollDelay: 4000,
    easing: 'cubic-bezier(0.77,0,0.175,1)',
    onSectionEnter: (idx) => { console.log('Section enter', idx); },
    onSectionLeave: (idx) => { console.log('Section leave', idx); },
  });
}); 
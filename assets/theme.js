(function () {
  var toggle = document.querySelector('.menu-toggle');
  var nav = document.getElementById('site-navigation');

  if (!toggle || !nav) return;

  function closeMenu() {
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
    nav.classList.remove('is-open');
  }

  toggle.addEventListener('click', function () {
    var isOpen = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!isOpen));
    toggle.setAttribute('aria-label', isOpen ? 'Open menu' : 'Close menu');
    nav.classList.toggle('is-open', !isOpen);
  });

  window.addEventListener('resize', function () {
    if (window.innerWidth > 767) {
      closeMenu();
    }
  });
}());

/* Apple TV Lite V3 — progressive macOS-inspired enhancements.
   Never asks root privileges or changes Home mapping. V2 application manager remains owner.
*/
(function () {
  'use strict';
  var search=document.getElementById('appSearch');
  if (!search || !window.V2_DEBUG) return;
  search.addEventListener('input',function () {
    window.V2_DEBUG.filterApps(search.value);
  });
  // Keep the LG system keyboard Enter from accidentally launching a highlighted tile.
  window.addEventListener('keydown',function (e) {
    if (document.activeElement !== search) return;
    if (e.keyCode===13) {
      e.preventDefault();e.stopImmediatePropagation();
      search.blur();
    }
  },true);
  // Visual label only; no privileged system service.
  document.documentElement.classList.add('macos-v3');
})();
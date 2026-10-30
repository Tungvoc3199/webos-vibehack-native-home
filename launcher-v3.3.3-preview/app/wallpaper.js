/* Offline-safe wallpaper picker for webOS TV. No new Luna permissions or background service. */
(function () {
  'use strict';
  var ROOT = document.getElementById('wallpaperLayer');
  var SHADE = document.getElementById('wallpaperShade');
  var MODAL = document.getElementById('wallpaperMenu');
  var OPTIONS = [
    {key: 'default', label: 'Mặc định', hint: 'Nền đen với ánh sáng theo ứng dụng'},
    {key: 'night', label: 'Midnight', hint: 'Xanh đậm tối giản'},
    {key: 'warm', label: 'Warm Slate', hint: 'Xám ấm, dễ đọc'},
    {key: 'custom', label: 'Ảnh từ điện thoại', hint: 'Ảnh đã chuyển và đóng gói vào TV'},
    {key: 'settings', label: 'Cài đặt TV', hint: 'Mở phần cài đặt của LG'},
    {key: 'close', label: 'Đóng', hint: 'Trở lại màn hình chính'}
  ];
  var index = 0, open = false, current = 'default';
  var savedKey = 'tvhome.wallpaper.choice';

  function notify(s) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = s;
    el.classList.add('shown');
    clearTimeout(notify.timer);
    notify.timer = setTimeout(function () { el.classList.remove('shown'); }, 2500);
  }
  function modeBackground(mode) {
    if (mode === 'night') return 'linear-gradient(130deg,#0e1c38,#172b40 46%,#050810)';
    if (mode === 'warm') return 'linear-gradient(130deg,#292c32,#524b47 48%,#101319)';
    if (mode === 'custom') return "url('wallpapers/custom.jpg')";
    return '';
  }
  function render(mode) {
    if (mode === 'default') {
      ROOT.style.backgroundImage = '';
      SHADE.style.opacity = '0';
      document.body.classList.remove('custom-wallpaper');
    } else {
      ROOT.style.backgroundImage = modeBackground(mode);
      SHADE.style.opacity = '1';
      document.body.classList.add('custom-wallpaper');
    }
    current = mode;
  }
  function selectMode(mode, persist) {
    if (mode === 'custom') {
      var img = new Image();
      img.onload = function () {
        render(mode);
        if (persist) save(mode);
        closeMenu();
        notify('Đã đặt ảnh nền từ điện thoại');
      };
      img.onerror = function () {
        notify('Chưa có ảnh. Hãy chuyển ảnh từ điện thoại trước.');
      };
      img.src = 'wallpapers/custom.jpg?check=1';
      return;
    }
    render(mode);
    if (persist) save(mode);
    closeMenu();
    notify('Đã đổi hình nền');
  }
  function save(mode) {
    try { localStorage.setItem(savedKey, mode); }
    catch (e) { notify('Không lưu được lựa chọn; cần kiểm tra bộ nhớ TV'); }
  }
  function refreshSelection() {
    var rows = MODAL.querySelectorAll('.wallpaper-option');
    for (var i = 0; i < rows.length; i++) {
      rows[i].classList.toggle('selected', i === index);
      rows[i].classList.toggle('active-wallpaper', OPTIONS[i].key === current);
    }
  }
  function openMenu() {
    if (open) return;
    index = 0;
    OPTIONS.forEach(function (o, i) { if (o.key === current) index = i; });
    open = true;
    MODAL.classList.remove('hidden');
    MODAL.setAttribute('aria-hidden', 'false');
    refreshSelection();
  }
  function closeMenu() {
    open = false;
    MODAL.classList.add('hidden');
    MODAL.setAttribute('aria-hidden', 'true');
  }
  function choose(i) {
    var key = OPTIONS[i].key;
    if (key === 'close') return closeMenu();
    if (key === 'settings') {
      closeMenu();
      try {
        var bridge = new PalmServiceBridge();
        bridge.call('luna://com.webos.applicationManager/launch',
          JSON.stringify({id: 'com.palm.app.settings'}));
      } catch (e) { notify('Không thể mở cài đặt TV'); }
      return;
    }
    selectMode(key, true);
  }
  function onKey(e) {
    if (!open) return false;
    var k = e.keyCode;
    if (k === 38 || k === 37) index = (index + OPTIONS.length - 1) % OPTIONS.length;
    else if (k === 40 || k === 39) index = (index + 1) % OPTIONS.length;
    else if (k === 13) choose(index);
    else if (k === 461 || k === 27 || k === 8) closeMenu();
    else return true;
    refreshSelection();
    return true;
  }
  function mountMenu() {
    MODAL.innerHTML = '';
    var heading = document.createElement('h2');
    heading.textContent = 'Hình nền & Cài đặt';
    MODAL.appendChild(heading);
    var sub = document.createElement('p');
    sub.className = 'wallpaper-subtitle';
    sub.textContent = 'Chọn hình nền bằng phím lên, xuống và OK';
    MODAL.appendChild(sub);
    OPTIONS.forEach(function (opt, i) {
      var row = document.createElement('div');
      row.className = 'wallpaper-option';
      var label = document.createElement('div');
      label.className = 'wallpaper-option-title';
      label.textContent = opt.label;
      var hint = document.createElement('div');
      hint.className = 'wallpaper-option-hint';
      hint.textContent = opt.hint;
      row.appendChild(label);
      row.appendChild(hint);
      row.addEventListener('mouseover', function () { index = i; refreshSelection(); });
      row.addEventListener('click', function () { choose(i); });
      MODAL.appendChild(row);
    });
  }
  mountMenu();
  // Capture phase protects the existing minified 1.0.1 keyboard/navigation contract.
  document.addEventListener('keydown', function (e) {
    var settings = document.getElementById('btnSettings');
    if (!open && e.keyCode === 13 && settings.classList.contains('focused')) {
      e.preventDefault(); e.stopImmediatePropagation(); openMenu(); return;
    }
    if (open) {
      onKey(e);
      e.preventDefault(); e.stopImmediatePropagation();
    }
  }, true);
  document.addEventListener('keyup', function (e) {
    if (open && (e.keyCode === 13 || e.keyCode === 461 || e.keyCode === 27)) {
      e.preventDefault(); e.stopImmediatePropagation();
    }
  }, true);
  document.getElementById('btnSettings').addEventListener('click', function (e) {
    e.preventDefault(); e.stopImmediatePropagation();
    openMenu();
  }, true);
  var saved = null;
  try { saved = localStorage.getItem(savedKey); } catch (e) {}
  var start = saved || (window.CONFIG && CONFIG.wallpaperDefault) || 'default';
  if (start === 'custom') selectMode(start, false);
  else render(start === 'night' || start === 'warm' ? start : 'default');
  window.LAUNCHER_WALLPAPER = {
    open: openMenu,
    close: closeMenu,
    isOpen: function () { return open; },
    handleKey: onKey
  };
})();
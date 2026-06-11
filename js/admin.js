(function () {
  function addControls(page) {
    // Topbar: add dashboard button before user section
    var topRight = document.querySelector('.topbar-right');
    if (topRight && !document.querySelector('.nb[aria-label="Дашборд"]')) {
      var btn = document.createElement('button');
      btn.className = 'nb' + (page === 'dashboard' ? ' on' : '');
      btn.setAttribute('aria-label', 'Дашборд');
      btn.innerHTML = ZAP.utils.icon('chart-bar', 18);
      btn.onclick = function () { ZAP.router.go('dashboard'); };
      var ref = topRight.querySelector('.topbar-user, .btn-outline');
      if (ref) { topRight.insertBefore(btn, ref); } else { topRight.appendChild(btn); }
    }

    // Bottom nav: change Профіль → Панель
    var items = document.querySelectorAll('.bn-item');
    for (var i = 0; i < items.length; i++) {
      var span = items[i].querySelector('span');
      if (span && span.textContent === 'Профіль') {
        items[i].onclick = function () { ZAP.router.go('dashboard'); };
        var div = items[i].querySelector('div');
        if (div) div.innerHTML = ZAP.utils.icon('chart-bar', 22);
        span.textContent = 'Панель';
        if (page === 'dashboard') { items[i].classList.add('on'); } else { items[i].classList.remove('on'); }
      }
    }
  }
  window.ZAP_ADMIN = { addControls: addControls };
})();

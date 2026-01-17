(function (ns, storage, auth, tickets, ui, toasts) {
  ns.events = ns.events || (function () {
    const map = {};
    return {
      on: (k, fn) => (map[k] = map[k] || []).push(fn),
      emit: (k, v) => (map[k] || []).forEach(f => f(v))
    };
  })();

  async function init() {
    storage.loadUsers();
    storage.loadTickets();
    storage.loadCurrentUser();

    auth.init && auth.init();
    tickets.initDragDrop && tickets.initDragDrop();
    ui.init && ui.init();

    const fetchSampleBtn = document.getElementById('fetchSample');
    if (fetchSampleBtn) {
      fetchSampleBtn.addEventListener('click', () => tickets.populateFromApi({ auto: false, source: 'dummy' }));
    }

    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
        themeToggle.textContent = '☀️ Tryb jasny';
      }
      themeToggle.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark');
        const isDark = document.documentElement.classList.contains('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        themeToggle.textContent = isDark ? '☀️ Tryb jasny' : '🌙 Tryb ciemny';
        toasts.show(`Przełączono na tryb ${isDark ? 'ciemny' : 'jasny'}.`, 'info');
      });
    }

    let resizeTimer = null;
    window.addEventListener('resize', () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        tickets.drawChart && tickets.drawChart();
        ui.createPaginationTabs && ui.createPaginationTabs();
      }, 120);
    });

    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  }

  ns.init = init;

  document.addEventListener('DOMContentLoaded', () => {
    init();
  });
})(window.Helpdesk = window.Helpdesk || {}, window.Helpdesk.storage, window.Helpdesk.auth, window.Helpdesk.tickets, window.Helpdesk.ui, window.Helpdesk.toasts);

(function () {
  const modal = document.getElementById('galleryModal');
  const modalImg = document.getElementById('galleryModalImg');
  const downloadLink = document.getElementById('galleryDownload');
  const closeBtn = document.getElementById('galleryCloseBtn');

  if (!modal || !modalImg || !downloadLink) return;

  document.addEventListener('click', (e) => {
    const img = e.target.closest('.gallery img');
    if (!img) return;

    const src = img.getAttribute('src');
    const alt = img.getAttribute('alt') || '';

    modalImg.src = src;
    modalImg.alt = alt;
    downloadLink.href = src;

    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
  });

  function closeModal() {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    modalImg.src = '';
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  if (closeBtn) closeBtn.addEventListener('click', closeModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeModal();
    }
  });
})();

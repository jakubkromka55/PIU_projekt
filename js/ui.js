(function (ns, storage, h) {
  const tabs = Array.from(document.querySelectorAll('.tab-btn'));
  const panels = Array.from(document.querySelectorAll('.tab-panel'));
  const newTicketBtn = document.getElementById('newTicketBtn');
  const createPanel = document.getElementById('createPanel');
  const cancelCreate = document.getElementById('cancelCreate');
  const form = document.getElementById('ticketForm');
  const submitTicketBtn = document.getElementById('submitTicketBtn');
  const searchInput = document.getElementById('search');
  const filterPriority = document.getElementById('filterPriority');
  const closePreviewBtn = document.getElementById('closePreviewBtn');
  const answeredList = document.getElementById('answeredList');

  let currentPage = 0;
  const PER_PAGE = 10;
  let editingId = null;

  function safeToast(message, type = 'info', timeout = 3500) {
    try {
      const t = (ns && ns.toasts) || (window.Helpdesk && window.Helpdesk.toasts);
      if (t && typeof t.show === 'function') {
        t.show(message, type, timeout);
      } else {
        console.log(`[toast ${type}] ${message}`);
      }
    } catch (e) {
      console.log('[toast error]', e, message);
    }
  }

  function activateTab(tabName) {
    tabs.forEach(b => {
      const active = b.dataset.tab === tabName;
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    panels.forEach(p => {
      if (p.id === tabName) {
        p.classList.remove('hidden');
      } else if (p.id !== 'authModal') {
        p.classList.add('hidden');
      }
    });

    if (tabName !== 'tickets' && createPanel) createPanel.classList.add('hidden');

    const previewPanel = document.getElementById('previewPanel');
    if (previewPanel) previewPanel.classList.add('hidden');

    if (ns.tickets && typeof ns.tickets.updateStatsUI === 'function') ns.tickets.updateStatsUI();
    if (ns.tickets && typeof ns.tickets.drawChart === 'function') ns.tickets.drawChart();
    ns.events && ns.events.emit && ns.events.emit('ui:refreshList');
  }

  function createPaginationTabs() {
    const filtered = ns.tickets.getFilteredTickets(searchInput && searchInput.value, filterPriority && filterPriority.value);
    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / PER_PAGE));
    const controls = document.querySelector('.controls') || document.body;
    const old = document.getElementById('pager');
    if (old) old.remove();
    const pager = document.createElement('div');
    pager.id = 'pager';
    pager.className = 'pager';
    for (let i = 0; i < pages; i++) {
      const btn = document.createElement('button');
      btn.textContent = `Strona ${i + 1}`;
      btn.dataset.page = i;
      btn.addEventListener('click', () => {
        currentPage = i;
        renderListPage(i);
        Array.from(pager.children).forEach(c => c.classList.toggle('active', c === btn));
      });
      if (i === 0) btn.classList.add('active');
      pager.appendChild(btn);
    }
    controls.appendChild(pager);
    currentPage = Math.min(currentPage, pages - 1);
    renderListPage(currentPage);
  }

  function renderListPage(page = 0) {
    const q = searchInput && searchInput.value || '';
    const pr = filterPriority && filterPriority.value || 'all';
    ns.tickets.renderListPage(page, PER_PAGE, q, pr);
  }

  function renderAnswered() {
    if (!answeredList) return;
    answeredList.innerHTML = '';
    const answeredTickets = storage.tickets.filter(t => t.replies && t.replies.length > 0);
    answeredTickets.forEach(t => answeredList.appendChild(ns._internal.ticketsModule.createTicketElement(t)));
  }

  function initListeners() {
    tabs.forEach(b => b.addEventListener('click', () => activateTab(b.dataset.tab)));

    if (newTicketBtn) newTicketBtn.addEventListener('click', () => {
      if (!createPanel) return;
      editingId = null;
      if (submitTicketBtn) submitTicketBtn.textContent = 'Utwórz';
      createPanel.classList.toggle('hidden');
      if (!createPanel.classList.contains('hidden')) document.getElementById('title').focus();
    });

    if (cancelCreate) cancelCreate.addEventListener('click', () => {
      if (createPanel) createPanel.classList.add('hidden');
      if (form) form.reset();
      editingId = null;
      if (submitTicketBtn) submitTicketBtn.textContent = 'Utwórz';
    });

    if (closePreviewBtn) {
      closePreviewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const previewPanel = document.getElementById('previewPanel');
        if (previewPanel) {
          previewPanel.classList.add('hidden');
          const previewContent = document.getElementById('previewContent');
          if (previewContent) previewContent.innerHTML = '';
          safeToast('Podgląd zamknięty.', 'info', 1800);
        }
      });
    }

    if (searchInput) searchInput.addEventListener('input', h.debounce(() => createPaginationTabs(), 250));
    if (filterPriority) filterPriority.addEventListener('change', () => createPaginationTabs());

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const data = new FormData(form);
        const title = (data.get('title') || '').trim();
        const description = (data.get('description') || '').trim();
        const priority = data.get('priority') || 'medium';
        const reporter = (data.get('reporter') || '').trim();
        if (!title || !description || !reporter) {
          safeToast('Uzupełnij wszystkie pola.', 'warn');
          return;
        }

        if (editingId) {
          const ticket = storage.tickets.find(t => t.id === editingId);
          if (!ticket) {
            safeToast('Nie znaleziono zgłoszenia do edycji.', 'error');
            editingId = null;
            form.reset();
            if (createPanel) createPanel.classList.add('hidden');
            if (submitTicketBtn) submitTicketBtn.textContent = 'Utwórz';
            return;
          }

          const currentUser = storage.currentUser;
          if (!currentUser || !(currentUser.role === 'admin' || currentUser.role === 'technician' || ticket.createdBy === currentUser.email)) {
            safeToast('Brak uprawnień do zapisu zmian.', 'error');
            return;
          }
          ticket.title = title;
          ticket.description = description;
          ticket.priority = priority;
          ticket.reporter = reporter;
          ticket.updatedAt = h.nowISO();
          storage.saveTickets();
          editingId = null;
          form.reset();
          if (createPanel) createPanel.classList.add('hidden');
          if (submitTicketBtn) submitTicketBtn.textContent = 'Utwórz';
          createPaginationTabs();
          safeToast('Zgłoszenie zaktualizowane.', 'success');
          return;
        }

        const ticket = {
          id: h.uid(),
          title,
          description,
          priority,
          reporter,
          status: 'new',
          createdAt: h.nowISO(),
          createdBy: storage.currentUser ? storage.currentUser.email : 'guest',
          assignedTo: storage.currentUser && storage.currentUser.role !== 'user' ? storage.currentUser.email : null
        };
        storage.tickets = [ticket, ...storage.tickets];
        form.reset();
        if (createPanel) createPanel.classList.add('hidden');
        createPaginationTabs();
        safeToast('Zgłoszenie utworzone.', 'success');
      });
    }

    ns.events.on('ticket:edit', (t) => {
      editingId = t.id;
      document.getElementById('title').value = t.title;
      document.getElementById('description').value = t.description;
      document.getElementById('priority').value = t.priority;
      document.getElementById('reporter').value = t.reporter;
      if (createPanel) createPanel.classList.remove('hidden');
      document.getElementById('title').focus();
      if (submitTicketBtn) submitTicketBtn.textContent = 'Zapisz';
      safeToast('Tryb edycji: wprowadź zmiany i kliknij Zapisz.', 'info', 4500);
    });


    ns.events.on('ui:refreshList', () => {
      createPaginationTabs();
      renderAnswered();
    });
  }

  function init() {
    initListeners();

    if (ns.tickets && typeof ns.tickets.updateStatsUI === 'function') ns.tickets.updateStatsUI();
    if (ns.tickets && typeof ns.tickets.drawChart === 'function') ns.tickets.drawChart();
    if (ns.tickets && typeof ns.tickets.renderBoard === 'function') ns.tickets.renderBoard();
    createPaginationTabs();
    renderAnswered();
  }

  ns.ui = {
    init,
    createPaginationTabs,
    renderListPage,
    renderAnswered
  };
})(window.Helpdesk = window.Helpdesk || {}, window.Helpdesk.storage, window.Helpdesk.helpers);

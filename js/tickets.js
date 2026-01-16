(function (ns, storage, h) {
  const template = document.getElementById('ticketTemplate');
  const listEl = document.getElementById('list');
  const previewPanel = document.getElementById('previewPanel');
  const previewContent = document.getElementById('previewContent');
  const replyPanel = document.getElementById('replyPanel');
  const replyText = document.getElementById('replyText');
  const sendReply = document.getElementById('sendReply');
  const cancelReply = document.getElementById('cancelReply');
  const canvas = document.getElementById('priorityChart');
  const breakdown = document.getElementById('breakdown');

  let replyingTo = null;

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

  function canModifyTicket(ticket) {
    const currentUser = storage.currentUser;
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    if (currentUser.role === 'technician') return true;
    return ticket.createdBy === currentUser.email;
  }

  function createTicketElement(t) {
    const node = template.content.cloneNode(true);
    const article = node.querySelector('.ticket');
    article.dataset.id = t.id;
    article.querySelector('.ticket-title').textContent = t.title;
    article.querySelector('.ticket-desc').textContent = t.description;
    article.querySelector('.ticket-reporter').textContent = t.reporter || '';
    article.querySelector('.ticket-date').textContent = new Date(t.createdAt).toLocaleString();
    const prEl = article.querySelector('.ticket-priority');
    prEl.textContent = t.priority;
    prEl.className = 'ticket-priority ' + (t.priority === 'high' ? 'priority-high' : t.priority === 'medium' ? 'priority-medium' : 'priority-low');

    const deleteBtn = article.querySelector('.delete');
    const editBtn = article.querySelector('.edit');
    const replyBtn = article.querySelector('.reply');

    const role = storage.currentUser?.role || 'guest';

    if (deleteBtn) deleteBtn.style.display = (role === 'admin') ? '' : 'none';

    if (editBtn) {
      const canEdit = role === 'admin' || (role === 'user' && t.createdBy === storage.currentUser?.email);
      editBtn.style.display = canEdit ? '' : 'none';
    }

    if (replyBtn) replyBtn.style.display = storage.currentUser ? '' : 'none';

    if (role === 'admin' || role === 'technician') {
      const statusBtn = document.createElement('button');
      statusBtn.className = 'btn icon status-btn';
      statusBtn.title = 'Zmień status';
      statusBtn.textContent = '⚑';
      statusBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const newStatus = prompt('Nowy status (new, inprogress, closed):', t.status || 'new');
        if (!newStatus) return;
        if (!['new','inprogress','closed'].includes(newStatus)) { safeToast('Nieprawidłowy status.', 'warn'); return; }
        t.status = newStatus;
        storage.saveTickets();
        showPreview(t);
        ns.events && ns.events.emit && ns.events.emit('tickets:changed');
        safeToast('Status zmieniony.', 'success');
      });
      const meta = article.querySelector('.ticket-meta');
      meta.insertBefore(statusBtn, meta.firstChild);
    }

    if (deleteBtn) {
      deleteBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (role !== 'admin') {
          safeToast('Nie masz uprawnień do usuwania zgłoszeń.', 'error');
          return;
        }
        if (!confirm('Usunąć zgłoszenie?')) return;
        storage.tickets = storage.tickets.filter(x => x.id !== t.id);
        ns.events && ns.events.emit && ns.events.emit('tickets:changed');
        safeToast('Zgłoszenie usunięte.', 'success');
      });
    }

    if (editBtn) {
      editBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (!canModifyTicket(t)) {
          safeToast('Brak uprawnień do edycji.', 'error');
          return;
        }
        ns.events && ns.events.emit && ns.events.emit('ticket:edit', t);
      });
    }

    article.addEventListener('click', (e) => {
      if (e.target.closest('.edit') || e.target.closest('.delete') || e.target.closest('.reply') || e.target.closest('.status-btn')) return;
      showPreview(t);
    });

    if (storage.currentUser && (storage.currentUser.role === 'admin' || storage.currentUser.role === 'technician')) {
      article.setAttribute('draggable', 'true');
      article.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', t.id);
        article.classList.add('dragging');
      });
      article.addEventListener('dragend', () => article.classList.remove('dragging'));
    } else {
      article.removeAttribute('draggable');
    }

    if (replyBtn) {
      replyBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        replyingTo = t.id;
        replyText.value = "";
        replyPanel.classList.remove('hidden');
        replyText.focus();
      });
    }

    if (t.replies && t.replies.length > 0) {
      const repliesBox = document.createElement('div');
      repliesBox.className = 'ticket-replies';
      const h = document.createElement('h5');
      h.style.margin = '6px 0 4px 0';
      h.style.fontSize = '0.85rem';
      h.style.color = '#374151';
      h.textContent = 'Odpowiedzi:';
      repliesBox.appendChild(h);

      t.replies.forEach(r => {
        const item = document.createElement('div');
        item.className = 'ticket-reply-item';
        const wrap = document.createElement('div');
        wrap.style.padding = '6px 10px';
        wrap.style.background = '#f3f4f6';
        wrap.style.borderRadius = '8px';
        wrap.style.marginBottom = '6px';
        const p = document.createElement('p');
        p.style.margin = '0';
        p.style.fontSize = '0.85rem';
        p.textContent = r.text;
        const small = document.createElement('small');
        small.style.color = '#6b7280';
        small.textContent = new Date(r.date).toLocaleString();
        wrap.appendChild(p);
        wrap.appendChild(small);
        item.appendChild(wrap);
        repliesBox.appendChild(item);
      });
      article.appendChild(repliesBox);
    }

    return article;
  }

  function getFilteredTickets(q = '', prFilter = 'all') {
    const query = (q || '').trim().toLowerCase();
    return storage.tickets.filter(t => {
      if (prFilter !== 'all' && t.priority !== prFilter) return false;
      if (!query) return true;
      return (t.title + ' ' + t.description + ' ' + (t.reporter || '')).toLowerCase().includes(query);
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function renderListPage(page = 0, perPage = 10, q = '', prFilter = 'all') {
    const filtered = getFilteredTickets(q, prFilter);
    const start = page * perPage;
    const slice = filtered.slice(start, start + perPage);
    if (listEl) {
      listEl.innerHTML = '';
      slice.forEach(t => listEl.appendChild(createTicketElement(t)));
    }
  }

  function clearColumns() {
    ['col-new','col-inprogress','col-closed'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '';
    });
  }
  function renderBoard() {
    clearColumns();
    storage.tickets.forEach(t => {
      const el = createTicketElement(t);
      const col = t.status === 'inprogress' ? 'col-inprogress' : t.status === 'closed' ? 'col-closed' : 'col-new';
      const container = document.getElementById(col);
      if (container) container.appendChild(el);
    });
  }

  function showPreview(t) {
    if (!previewPanel || !previewContent) return;
    previewPanel.classList.remove('hidden');
    previewContent.innerHTML = '';
    const h = document.createElement('h4'); h.textContent = t.title;
    const p = document.createElement('p'); p.textContent = t.description;
    const pri = document.createElement('p'); pri.innerHTML = `<strong>Priorytet:</strong> ${t.priority}`;
    const rep = document.createElement('p'); rep.innerHTML = `<strong>Zgłaszający:</strong> ${t.reporter || ''}`;
    const assigned = document.createElement('p'); assigned.innerHTML = `<strong>Przypisane do:</strong> ${t.assignedTo || '—'}`;
    const date = document.createElement('p'); date.innerHTML = `<small>${new Date(t.createdAt).toLocaleString()}</small>`;
    previewContent.append(h, p, pri, rep, assigned, date);

    if (t.replies && t.replies.length > 0) {
      const hr = document.createElement('h4'); hr.textContent = 'Odpowiedzi:';
      previewContent.appendChild(hr);
      t.replies.forEach(r => {
        const wrap = document.createElement('div');
        wrap.className = 'reply-item';
        const rp = document.createElement('p'); rp.textContent = r.text;
        const small = document.createElement('small'); small.textContent = new Date(r.date).toLocaleString();
        wrap.append(rp, small);
        previewContent.appendChild(wrap);
      });
    }
  }

  if (sendReply) {
    sendReply.addEventListener('click', () => {
      if (!replyingTo) return;
      const text = (replyText.value || '').trim();
      if (!text) {
        safeToast("Wpisz odpowiedź.", 'warn');
        return;
      }
      const ticket = storage.tickets.find(t => t.id === replyingTo);
      if (!ticket) return;
      if (!ticket.replies) ticket.replies = [];
      ticket.replies.push({ text, date: new Date().toISOString() });
      storage.saveTickets();
      replyPanel.classList.add('hidden');
      replyText.value = "";
      replyingTo = null;
      showPreview(ticket);
      safeToast('Odpowiedź wysłana.', 'success');
    });
  }
  if (cancelReply) {
    cancelReply.addEventListener('click', () => {
      replyPanel.classList.add('hidden');
      replyText.value = "";
      replyingTo = null;
    });
  }

  function computeStats() {
    const total = storage.tickets.length;
    const open = storage.tickets.filter(t => t.status === 'new').length;
    const inprogress = storage.tickets.filter(t => t.status === 'inprogress').length;
    const closed = storage.tickets.filter(t => t.status === 'closed').length;
    const byPriority = {
      high: storage.tickets.filter(t => t.priority === 'high').length,
      medium: storage.tickets.filter(t => t.priority === 'medium').length,
      low: storage.tickets.filter(t => t.priority === 'low').length
    };
    return { total, open, inprogress, closed, byPriority };
  }

  function updateStatsUI() {
    const s = computeStats();
    const statEls = {
      total: document.getElementById('stat-total'),
      open: document.getElementById('stat-open'),
      inprogress: document.getElementById('stat-inprogress'),
      closed: document.getElementById('stat-closed')
    };
    if (statEls.total) statEls.total.textContent = s.total;
    if (statEls.open) statEls.open.textContent = s.open;
    if (statEls.inprogress) statEls.inprogress.textContent = s.inprogress;
    if (statEls.closed) statEls.closed.textContent = s.closed;

    if (breakdown) {
      breakdown.innerHTML = '';
      ['high','medium','low'].forEach(k => {
        const li = document.createElement('li');
        li.innerHTML = `<span style="text-transform:capitalize">${k}</span><strong>${s.byPriority[k]}</strong>`;
        breakdown.appendChild(li);
      });
    }
  }

  function drawChart() {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const cssWidth = Math.max(300, Math.floor(rect.width)) || 600;
    const cssHeight = Math.max(200, Math.floor(rect.height)) || 320;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const padding = { top: 40, right: 20, bottom: 56, left: 44 };
    const width = cssWidth - padding.left - padding.right;
    const height = cssHeight - padding.top - padding.bottom;

    const { byPriority } = computeStats();
    const labels = ['Wysoki', 'Średni', 'Niski'];
    const keys = ['high', 'medium', 'low'];
    const colors = ['#ef4444', '#f59e0b', '#10b981'];
    const values = keys.map(k => byPriority[k]);

    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const maxVal = Math.max(...values, 1);
    const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(1, maxVal))));
    let yMax = Math.ceil(maxVal / magnitude) * magnitude;
    if (yMax < maxVal) yMax = maxVal;
    const desiredTicks = 4;
    const tickStep = Math.max(1, Math.ceil(yMax / desiredTicks));
    yMax = tickStep * desiredTicks;

    const originX = padding.left;
    const originY = padding.top + height;

    ctx.font = '12px system-ui, Inter, Arial';
    ctx.fillStyle = '#374151';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(15,22,39,0.06)';
    ctx.lineWidth = 1;

    for (let t = 0; t <= yMax; t += tickStep) {
      const y = originY - (t / (yMax || 1)) * height;
      ctx.beginPath();
      ctx.moveTo(originX, y);
      ctx.lineTo(originX + width, y);
      ctx.stroke();
      ctx.fillStyle = '#374151';
      ctx.fillText(String(t), originX - 8, y);
    }

    const barGap = Math.max(12, Math.floor(width * 0.04));
    const availableWidth = width - (labels.length + 1) * barGap;
    const barWidth = Math.max(18, Math.floor(availableWidth / labels.length * 0.9));
    const totalBarsWidth = labels.length * barWidth + (labels.length + 1) * barGap;
    let x = originX + Math.max(0, Math.floor((width - totalBarsWidth) / 2)) + barGap;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    values.forEach((val, i) => {
      const barHeight = (val / (yMax || 1)) * height;
      const barX = x;
      const barY = originY - barHeight;

      ctx.fillStyle = 'rgba(2,6,23,0.06)';
      ctx.fillRect(barX + 2, barY + 4, barWidth, barHeight);

      ctx.fillStyle = colors[i];
      ctx.fillRect(barX, barY, barWidth, barHeight);

      ctx.fillStyle = '#0b1220';
      ctx.font = '600 13px system-ui, Inter, Arial';
      ctx.fillText(String(val), barX + barWidth / 2, Math.max(4, barY - 18));

      ctx.fillStyle = '#374151';
      ctx.font = '13px system-ui, Inter, Arial';
      ctx.fillText(labels[i], barX + barWidth / 2, originY + 8);

      x += barWidth + barGap;
    });

    ctx.fillStyle = '#0b1220';
    ctx.font = '600 15px system-ui, Inter, Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Rozkład zgłoszeń według priorytetu', padding.left + width / 2, 12);
  }

  // API
  ns.tickets = {
    createTicketElement,
    renderBoard,
    renderListPage,
    getFilteredTickets,
    showPreview,
    computeStats,
    updateStatsUI,
    drawChart,
    initDragDrop: function () {
      document.querySelectorAll('.column-body').forEach(col => {
        col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('drag-over'); });
        col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
        col.addEventListener('drop', (e) => {
          e.preventDefault();
          col.classList.remove('drag-over');
          const id = e.dataTransfer.getData('text/plain');
          const t = storage.tickets.find(x => x.id === id);
          if (!t) return;
          if (!storage.currentUser || (storage.currentUser.role !== 'admin' && storage.currentUser.role !== 'technician')) {
            safeToast('Nie masz uprawnień do przenoszenia zgłoszeń.', 'error');
            return;
          }
          const status = col.parentElement.dataset.status;
          t.status = status;
          storage.saveTickets();
          ns.events && ns.events.emit && ns.events.emit('tickets:changed');
          safeToast('Zgłoszenie przeniesione.', 'success');
        });
      });
    },
    fetchSampleTickets: async function (useDummy = true) {
      const DUMMY_POSTS = 'https://dummyjson.com/posts';
      const JSONPLACEHOLDER = 'https://jsonplaceholder.typicode.com/posts';
      const url = useDummy ? DUMMY_POSTS : JSONPLACEHOLDER + '?_limit=30';
      const res = await fetch(url);
      const data = await res.json();
      const items = data.posts || data;
      const slice = items.slice(0, storage.MAX_TICKETS);
      return slice.map((p, i) => ({
        id: 'api-' + (p.id ?? i) + '-' + Math.random().toString(36).slice(2, 6),
        title: p.title || `Zgłoszenie ${i + 1}`,
        description: p.body || p.description || '',
        priority: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
        reporter: (p.userId ? `user${p.userId}@example.com` : `user${i + 1}@example.com`),
        status: 'new',
        createdAt: new Date(Date.now() - Math.random() * 1e10).toISOString()
      }));
    },
    populateFromApi: async function ({ auto = false, source = 'dummy' } = {}) {
      try {
        const fetched = await ns.tickets.fetchSampleTickets(source === 'dummy');
        const merged = [...fetched, ...storage.tickets];
        storage.tickets = merged.slice(0, storage.MAX_TICKETS);
        if (auto) {
          console.info('Auto-populate: added', fetched.length);
          safeToast('Automatycznie pobrano próbne zgłoszenia.', 'info');
        } else {
          safeToast('Pobrano próbne zgłoszenia.', 'success');
        }
      } catch (e) {
        console.error('Fetch error', e);
        safeToast('Błąd pobierania próbek. Sprawdź konsolę.', 'error');
      }
    }
  };

  ns.events = ns.events || (function () {
    const map = {};
    return {
      on: (k, fn) => (map[k] = map[k] || []).push(fn),
      emit: (k, v) => (map[k] || []).forEach(f => f(v))
    };
  })();

  ns.events.on('tickets:changed', () => {
    ns.tickets.updateStatsUI();
    ns.tickets.drawChart();
    ns.tickets.renderBoard();
    ns.events.emit('ui:refreshList');
  });

  ns._internal = ns._internal || {};
  ns._internal.ticketsModule = {
    showPreview,
    createTicketElement
  };

})(window.Helpdesk = window.Helpdesk || {}, window.Helpdesk.storage, window.Helpdesk.helpers);
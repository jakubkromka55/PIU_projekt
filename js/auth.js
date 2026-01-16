(function (ns, storage, h, toasts) {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const loginOpen = document.getElementById('loginOpen');
  const authClose = document.getElementById('authClose');
  const logoutBtn = document.getElementById('logoutBtn');
  const currentUserLabel = document.getElementById('currentUserLabel');
  const authModal = document.getElementById('authModal');

  function updateAuthUI() {
    if (!currentUserLabel || !loginOpen || !logoutBtn) return;
    const user = storage.currentUser;
    if (user) {
      currentUserLabel.textContent = `${user.email} (${user.role})`;
      loginOpen.classList.add('hidden');
      logoutBtn.classList.remove('hidden');
    } else {
      currentUserLabel.textContent = 'Niezalogowany';
      loginOpen.classList.remove('hidden');
      logoutBtn.classList.add('hidden');
    }
  }

  function openAuthModal() {
    if (!authModal) return;
    authModal.classList.remove('hidden');
    const first = authModal.querySelector('input, button, select, textarea');
    if (first) first.focus();
  }
  function closeAuthModal() {
    if (!authModal) return;
    authModal.classList.add('hidden');
    const homeBtn = document.querySelector('.tab-btn[data-tab="home"]');
    if (homeBtn) homeBtn.click();
  }

  function initListeners() {
    if (loginOpen) loginOpen.addEventListener('click', openAuthModal);
    if (authClose) authClose.addEventListener('click', closeAuthModal);
    if (logoutBtn) logoutBtn.addEventListener('click', () => {
      storage.currentUser = null;
      toasts.show('Wylogowano.', 'success');
    });

    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const data = new FormData(loginForm);
        const email = (data.get('email') || '').trim().toLowerCase();
        const password = (data.get('password') || '').trim();
        if (!email || !password) {
          toasts.show('Podaj email i hasło.', 'warn');
          return;
        }
        const user = storage.users.find(u => u.email === email && u.password === password);
        if (!user) {
          toasts.show('Nieprawidłowy email lub hasło.', 'error');
          return;
        }
        storage.currentUser = { id: user.id, email: user.email, role: user.role };
        toasts.show(`Zalogowano jako ${user.email} (${user.role}).`, 'success');
        closeAuthModal();
      });
    }

    if (registerForm) {
      registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const data = new FormData(registerForm);
        const email = (data.get('email') || '').trim().toLowerCase();
        const password = (data.get('password') || '').trim();

        if (!email || !password) {
          toasts.show('Podaj email i hasło.', 'warn');
          return;
        }

        const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRe.test(email)) {
          toasts.show('Podaj poprawny adres email.', 'warn');
          return;
        }

        try {
          const created = storage.addUser({ email, password, role: 'user' });
          if (!created) {
            toasts.show('Użytkownik o takim emailu już istnieje.', 'warn');
            return;
          }

          storage.currentUser = { id: created.id, email: created.email, role: created.role };

          toasts.show(`Zarejestrowano i zalogowano jako ${created.email}.`, 'success');
          registerForm.reset();

          storage.loadUsers();
          ns.events && ns.events.emit && ns.events.emit('users:changed');
          ns.events && ns.events.emit && ns.events.emit('auth:changed');

          closeAuthModal();
          const ticketsTab = document.querySelector('.tab-btn[data-tab="tickets"]');
          if (ticketsTab) ticketsTab.click();
        } catch (err) {
          console.error('Register error', err);
          toasts.show('Błąd rejestracji. Sprawdź konsolę.', 'error');
        }
      });
    }
  }

  ns.events = ns.events || (function () {
    const map = {};
    return {
      on: (k, fn) => (map[k] = map[k] || []).push(fn),
      emit: (k, v) => (map[k] || []).forEach(f => f(v))
    };
  })();

  ns.events.on('auth:changed', updateAuthUI);
  ns.events.on('users:changed', updateAuthUI);

  ns.auth = {
    init: function () {
      initListeners();
      updateAuthUI();
    }
  };
})(window.Helpdesk = window.Helpdesk || {}, window.Helpdesk.storage, window.Helpdesk.helpers || (window.Helpdesk.helpers = {}), window.Helpdesk.toasts || (window.Helpdesk.toasts = {}));
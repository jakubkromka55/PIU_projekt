(function (ns, h) {
  const STORAGE_KEY = 'helpdesk:v2:tickets';
  const USERS_KEY = 'helpdesk:v2:users';
  const CURRENT_USER_KEY = 'helpdesk:v2:currentUser';
  const MAX_TICKETS = 30;

  let tickets = [];
  let users = [];
  let currentUser = null;

  function loadTickets() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      tickets = raw ? JSON.parse(raw) : [];
    } catch (e) {
      tickets = [];
      console.error('Load tickets error', e);
    }
  }
  function saveTickets() {
    if (tickets.length > MAX_TICKETS) tickets = tickets.slice(0, MAX_TICKETS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
    ns.events && ns.events.emit && ns.events.emit('tickets:changed');
  }

  function loadUsers() {
    try {
      const raw = localStorage.getItem(USERS_KEY);
      users = raw ? JSON.parse(raw) : [];
    } catch (e) {
      users = [];
      console.error('Load users error', e);
    }
    if (!users || users.length === 0) {
      users = [
        { id: h.uid(), email: 'admin@example.com', password: 'admin', role: 'admin' },
        { id: h.uid(), email: 'technik@example.com', password: 'technik', role: 'technician' },
        { id: h.uid(), email: 'user@example.com', password: 'user', role: 'user' }
      ];
      saveUsers();
    }
  }
  function saveUsers() {
    try {
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      ns.events && ns.events.emit && ns.events.emit('users:changed');
    } catch (e) {
      console.error('Save users error', e);
    }
  }

  function addUser({ email, password, role = 'user' } = {}) {
    if (!email || !password) throw new Error('Email i hasło są wymagane');
    const exists = users.find(u => u.email === email.toLowerCase());
    if (exists) return null;
    const user = { id: h.uid(), email: email.toLowerCase(), password, role };
    users.push(user);
    saveUsers();
    return user;
  }

  function loadCurrentUser() {
    try {
      const raw = localStorage.getItem(CURRENT_USER_KEY);
      currentUser = raw ? JSON.parse(raw) : null;
    } catch (e) {
      currentUser = null;
    }
    ns.events && ns.events.emit && ns.events.emit('auth:changed');
  }
  function saveCurrentUser() {
    if (currentUser) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(CURRENT_USER_KEY);
    }
    ns.events && ns.events.emit && ns.events.emit('auth:changed');
    ns.events && ns.events.emit && ns.events.emit('tickets:changed');
  }

  ns.storage = {
    get tickets() { return tickets; },
    set tickets(v) { tickets = v; saveTickets(); },
    get users() { return users; },
    get currentUser() { return currentUser; },
    set currentUser(v) { currentUser = v; saveCurrentUser(); },

    loadTickets,
    saveTickets,
    loadUsers,
    saveUsers,
    loadCurrentUser,
    saveCurrentUser,
    addUser,
    MAX_TICKETS
  };
})(window.Helpdesk = window.Helpdesk || {}, window.Helpdesk.helpers || (window.Helpdesk.helpers = {}));
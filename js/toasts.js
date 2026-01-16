(function (ns) {
  ns.toasts = ns.toasts || {};

  const CONTAINER_ID = 'toastContainer';
  const DEFAULT_TIMEOUT = 3500;

  function ensureContainer() {
    let c = document.getElementById(CONTAINER_ID);
    if (!c) {
      c = document.createElement('div');
      c.id = CONTAINER_ID;
      c.className = 'toast-container';
      c.setAttribute('aria-live', 'polite');
      c.setAttribute('aria-atomic', 'true');
      document.body.appendChild(c);
    }
    return c;
  }

  function createToastElement(id, message, type) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.id = id;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');

    const icon = document.createElement('div');
    icon.className = 'toast-icon';
    icon.textContent = type === 'success' ? '✔' : type === 'error' ? '✖' : type === 'warn' ? '⚠' : 'ℹ';

    const body = document.createElement('div');
    body.className = 'toast-body';
    body.textContent = message;

    const close = document.createElement('button');
    close.className = 'toast-close';
    close.setAttribute('aria-label', 'Zamknij powiadomienie');
    close.textContent = '✕';
    close.addEventListener('click', () => remove(id));

    toast.appendChild(icon);
    toast.appendChild(body);
    toast.appendChild(close);

    return toast;
  }

  function show(message, type = 'info', timeout = DEFAULT_TIMEOUT) {
    try {
      const container = ensureContainer();
      const id = 't-' + Math.random().toString(36).slice(2, 9);
      const el = createToastElement(id, message, type);
      container.appendChild(el);

      requestAnimationFrame(() => el.classList.add('show'));

      if (timeout > 0) {
        setTimeout(() => remove(id), timeout);
      }
      return id;
    } catch (e) {
      console.log(`[toast ${type}] ${message}`);
      return null;
    }
  }

  function remove(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('show');
    setTimeout(() => {
      if (el && el.parentElement) el.parentElement.removeChild(el);
    }, 260);
  }

  ns.toasts.show = show;
  ns.toasts.remove = remove;

})(window.Helpdesk = window.Helpdesk || {});

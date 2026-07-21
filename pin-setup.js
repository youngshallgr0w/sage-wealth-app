/* ══════════════════════════════════════════════
   SAGE WEALTH — pin-setup.js
   First-time PIN creation flow (shown once on main.html)
   ══════════════════════════════════════════════ */

(function () {
  const PIN_LEN = 4;

  const overlay = document.getElementById('pinSetupOverlay');
  if (!overlay) return;

  let createEntry = '';
  let confirmEntry = '';
  let pendingPin = '';

  function showStep(id) {
    overlay.querySelectorAll('.pin-step').forEach(s => s.classList.remove('active', 'step-in'));
    const target = document.getElementById(id);
    target.classList.add('active');
    void target.offsetWidth;
    target.classList.add('step-in');
  }

  function renderCreateDots() {
    const row = document.getElementById('setupDotsCreate');
    if (!row) return;
    row.innerHTML = '';
    for (let i = 0; i < PIN_LEN; i++) {
      const dot = document.createElement('div');
      dot.className = 'pin-dot' + (i < createEntry.length ? ' filled' : '');
      row.appendChild(dot);
    }
    const continueBtn = document.getElementById('pinCreateContinue');
    if (continueBtn) continueBtn.disabled = createEntry.length < PIN_LEN;
  }

  function renderConfirmDots() {
    const row = document.getElementById('setupDotsConfirm');
    if (!row) return;
    row.innerHTML = '';
    for (let i = 0; i < pendingPin.length; i++) {
      const dot = document.createElement('div');
      dot.className = 'pin-dot' + (i < confirmEntry.length ? ' filled' : '');
      row.appendChild(dot);
    }
  }

  function shakeConfirmDots() {
    const dots = [...document.querySelectorAll('#setupDotsConfirm .pin-dot')];
    dots.forEach(d => { d.classList.remove('filled'); d.classList.add('error'); void d.offsetWidth; d.classList.add('shake'); });
    setTimeout(() => {
      dots.forEach(d => d.classList.remove('error', 'shake'));
      confirmEntry = '';
      renderConfirmDots();
    }, 700);
  }

  function wireKeypad(containerId, onDigit, onDelete) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll('.key-btn[data-val]').forEach(btn => {
      btn.addEventListener('click', () => onDigit(btn.dataset.val));
    });
    const del = container.querySelector('.key-del');
    del && del.addEventListener('click', onDelete);
  }

  wireKeypad('pinKeypadCreate', (val) => {
    if (createEntry.length >= PIN_LEN) return;
    createEntry += val;
    renderCreateDots();
  }, () => {
    createEntry = createEntry.slice(0, -1);
    renderCreateDots();
  });

  wireKeypad('pinKeypadConfirm', (val) => {
    if (confirmEntry.length >= pendingPin.length) return;
    confirmEntry += val;
    renderConfirmDots();

    if (confirmEntry.length === pendingPin.length) {
      setTimeout(() => {
        if (confirmEntry === pendingPin) {
          localStorage.setItem('sw_user_pin', pendingPin);
          localStorage.setItem('sw_pin_setup_done', '1');
          if (window.sw && typeof window.sw.updateProfilePin === 'function') {
            window.sw.updateProfilePin(pendingPin).catch(() => {});
          }
          showStep('pinStepSuccess');
        } else {
          const err = document.getElementById('pinSetupError');
          shakeConfirmDots();
          if (err) err.classList.remove('hidden');
          setTimeout(() => { if (err) err.classList.add('hidden'); }, 2500);
        }
      }, 120);
    }
  }, () => {
    confirmEntry = confirmEntry.slice(0, -1);
    renderConfirmDots();
  });

  document.getElementById('pinIntroContinue').addEventListener('click', () => {
    createEntry = '';
    renderCreateDots();
    showStep('pinStepCreate');
  });

  document.getElementById('pinCreateBack').addEventListener('click', () => {
    showStep('pinStepIntro');
  });

  document.getElementById('pinCreateContinue').addEventListener('click', () => {
    if (createEntry.length < PIN_LEN) return;
    pendingPin = createEntry;
    confirmEntry = '';
    renderConfirmDots();
    showStep('pinStepConfirm');
  });

  document.getElementById('pinConfirmBack').addEventListener('click', () => {
    createEntry = '';
    confirmEntry = '';
    renderCreateDots();
    showStep('pinStepCreate');
  });

  document.getElementById('pinSetupDone').addEventListener('click', () => {
    overlay.classList.add('hidden');
  });

  renderCreateDots();

  // Called by app.js once the dashboard is visible.
  window.maybeShowPinSetup = function () {
    if (localStorage.getItem('sw_pin_setup_done')) return;
    setTimeout(() => {
      overlay.classList.remove('hidden');
    }, 3000);
  };
})();

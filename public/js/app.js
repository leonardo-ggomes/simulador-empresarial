/**
 * Aurora Business Lab - Cliente Frontend Profissional
 * Gerenciamento de Conexão em Tempo Real, GSAP Microinterações e Side Sheets
 */

window.auroraSocket = null;

// Inicialização do Socket.IO
function initSocketConnection() {
  if (typeof io === 'undefined') return;

  const dot = document.getElementById('socket-dot');
  const text = document.getElementById('socket-text');

  window.auroraSocket = io({
    reconnection: true,
    reconnectionAttempts: 8,
    reconnectionDelay: 1200
  });

  window.auroraSocket.on('connect', () => {
    if (dot) dot.className = 'w-1.5 h-1.5 rounded-full bg-emerald-500';
    if (text) text.textContent = 'Conectado';

    const salaElement = document.querySelector('[data-sala-id]');
    if (salaElement && salaElement.dataset.salaId) {
      window.auroraSocket.emit('sala:entrar', { codigo: salaElement.dataset.salaCodigo });
    }
  });

  window.auroraSocket.on('disconnect', () => {
    if (dot) dot.className = 'w-1.5 h-1.5 rounded-full bg-rose-500';
    if (text) text.textContent = 'Desconectado';
  });

  window.auroraSocket.on('reconnecting', () => {
    if (dot) dot.className = 'w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse';
    if (text) text.textContent = 'Reconectando';
  });

  window.auroraSocket.on('resultado:publicar', (data) => {
    showToast(`Rodada ${data.rodada} fechada! Novos dados disponíveis.`, 'sucesso');
    setTimeout(() => window.location.reload(), 1200);
  });

  window.auroraSocket.on('rodada:iniciada', (data) => {
    showToast(`Simulação iniciada pelo professor! Rodada ${data.rodadaAtual}.`, 'info');
    setTimeout(() => window.location.reload(), 1000);
  });
}

// Side Sheet Contextual com GSAP
function abrirSideSheet(titulo, htmlContent) {
  const backdrop = document.getElementById('side-sheet-backdrop');
  const panel = document.getElementById('side-sheet-panel');
  const titleEl = document.getElementById('side-sheet-title');
  const contentEl = document.getElementById('side-sheet-content');

  if (!panel || !backdrop) return;

  if (titleEl) titleEl.textContent = titulo;
  if (contentEl) contentEl.innerHTML = htmlContent;

  backdrop.classList.add('active');
  panel.classList.add('active');

  if (typeof gsap !== 'undefined') {
    gsap.to(panel, {
      x: 0,
      duration: 0.28,
      ease: 'power2.out'
    });
  } else {
    panel.style.transform = 'translateX(0)';
  }
}

function fecharSideSheet() {
  const backdrop = document.getElementById('side-sheet-backdrop');
  const panel = document.getElementById('side-sheet-panel');

  if (!panel || !backdrop) return;

  backdrop.classList.remove('active');
  panel.classList.remove('active');

  if (typeof gsap !== 'undefined') {
    gsap.to(panel, {
      x: '100%',
      duration: 0.22,
      ease: 'power2.in'
    });
  } else {
    panel.style.transform = 'translateX(100%)';
  }
}

// Exporta explicitamente no escopo global window para acesso de qualquer view ou módulo
window.abrirSideSheet = abrirSideSheet;
window.fecharSideSheet = fecharSideSheet;
window.showToast = showToast;

// Fechamento de Sheet com Tecla Escape
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    fecharSideSheet();
  }
});

// Toast Notifier Minimalista
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const typeStyles = {
    sucesso: 'bg-slate-900 text-white border-slate-800',
    erro: 'bg-rose-950 text-rose-100 border-rose-800',
    alerta: 'bg-amber-950 text-amber-100 border-amber-800',
    info: 'bg-slate-900 text-white border-slate-800'
  };

  const icons = {
    sucesso: '<span class="text-emerald-400">●</span>',
    erro: '<span class="text-rose-400">●</span>',
    alerta: '<span class="text-amber-400">●</span>',
    info: '<span class="text-blue-400">●</span>'
  };

  const toast = document.createElement('div');
  toast.className = `px-3.5 py-2.5 rounded-lg border text-xs font-medium flex items-center gap-2.5 pointer-events-auto shadow-md ${typeStyles[type] || typeStyles.info}`;
  toast.innerHTML = `${icons[type] || '•'} <span>${message}</span>`;

  container.appendChild(toast);

  if (typeof gsap !== 'undefined') {
    gsap.fromTo(toast, 
      { opacity: 0, y: 12, scale: 0.98 },
      { opacity: 1, y: 0, scale: 1, duration: 0.2, ease: 'power2.out' }
    );
  }

  setTimeout(() => {
    if (typeof gsap !== 'undefined') {
      gsap.to(toast, {
        opacity: 0,
        y: 8,
        duration: 0.2,
        ease: 'power2.in',
        onComplete: () => toast.remove()
      });
    } else {
      toast.remove();
    }
  }, 3500);
}

// Logout do Usuário
async function fazerLogout() {
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'x-csrf-token': csrfToken }
    });
    window.location.href = '/auth/login';
  } catch (err) {
    window.location.href = '/auth/login';
  }
}

window.addEventListener('DOMContentLoaded', () => {
  initSocketConnection();
});

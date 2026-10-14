/**
 * Middlewares de Autenticação, Perfis e Segurança CSRF
 * Aurora Business Lab - Porto Aurora 2031
 */

import crypto from 'node:crypto';

/**
 * Exige que o usuário esteja autenticado na sessão.
 */
export function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.status(401).json({ error: 'Autenticação necessária. Faça login.' });
    }
    return res.redirect('/auth/login');
  }
  next();
}

/**
 * Exige perfis específicos (ex: 'professor', 'admin').
 * @param {string|string[]} roles
 */
export function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: 'Acesso não autorizado.' });
    }
    if (!allowed.includes(req.session.user.perfil)) {
      return res.status(403).json({
        error: `Permissão insuficiente. Este recurso requer perfil: ${allowed.join(' ou ')}.`
      });
    }
    next();
  };
}

/**
 * Proteção CSRF baseada em token de sessão para formulários e requisições AJAX.
 */
export function csrfProtection(req, res, next) {
  if (!req.session) return next();

  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  }

  res.locals.csrfToken = req.session.csrfToken;
  res.locals.currentUser = req.session.user || null;

  // Métodos que não alteram estado são liberados
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Verifica token no cabeçalho ou body
  const clientToken = req.headers['x-csrf-token'] || (req.body && req.body._csrf);

  if (!clientToken || clientToken !== req.session.csrfToken) {
    return res.status(403).json({ error: 'Token CSRF inválido ou ausente. Recarregue a página.' });
  }

  next();
}

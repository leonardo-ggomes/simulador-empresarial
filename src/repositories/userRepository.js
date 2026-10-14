/**
 * Repositório de Usuários
 * Aurora Business Lab - Porto Aurora 2031
 */

import { getDatabase } from './db.js';

export class UserRepository {
  constructor(db = null) {
    this.db = db || getDatabase();
  }

  createUser({ id, email, senhaHash, nome, perfil }) {
    const stmt = this.db.prepare(`
      INSERT INTO usuarios (id, email, senha_hash, nome, perfil, criado_em)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `);
    stmt.run(id, email.toLowerCase().trim(), senhaHash, nome.trim(), perfil);
    return this.findById(id);
  }

  findByEmail(email) {
    if (!email) return null;
    return this.db.prepare(`
      SELECT * FROM usuarios WHERE LOWER(email) = LOWER(?)
    `).get(email.trim());
  }

  findById(id) {
    if (!id) return null;
    return this.db.prepare(`
      SELECT * FROM usuarios WHERE id = ?
    `).get(id);
  }

  listAll() {
    return this.db.prepare(`
      SELECT id, email, nome, perfil, criado_em FROM usuarios ORDER BY criado_em DESC
    `).all();
  }
}

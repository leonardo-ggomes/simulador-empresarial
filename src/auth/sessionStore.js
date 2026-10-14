/**
 * Armazenamento de Sessões Express no SQLite (Session Store nativo)
 * Aurora Business Lab - Porto Aurora 2031
 */

import session from 'express-session';
import { getDatabase } from '../repositories/db.js';

export class SQLiteSessionStore extends session.Store {
  constructor(options = {}) {
    super();
    this.db = options.db || getDatabase();
    this._ensureTable();
  }

  _ensureTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid TEXT PRIMARY KEY,
        sess TEXT NOT NULL,
        expired INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_expired ON sessions(expired);
    `);
  }

  get(sid, callback) {
    try {
      const now = Date.now();
      const row = this.db.prepare('SELECT sess FROM sessions WHERE sid = ? AND expired > ?').get(sid, now);
      if (!row) {
        return callback(null, null);
      }
      const data = JSON.parse(row.sess);
      callback(null, data);
    } catch (err) {
      callback(err);
    }
  }

  set(sid, sess, callback) {
    try {
      const maxAge = sess.cookie && sess.cookie.maxAge ? sess.cookie.maxAge : 86400000;
      const expired = Date.now() + maxAge;
      const sessStr = JSON.stringify(sess);

      this.db.prepare(`
        INSERT INTO sessions (sid, sess, expired)
        VALUES (?, ?, ?)
        ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expired = excluded.expired
      `).run(sid, sessStr, expired);

      if (callback) callback(null);
    } catch (err) {
      if (callback) callback(err);
    }
  }

  destroy(sid, callback) {
    try {
      this.db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
      if (callback) callback(null);
    } catch (err) {
      if (callback) callback(err);
    }
  }

  touch(sid, sess, callback) {
    try {
      const maxAge = sess.cookie && sess.cookie.maxAge ? sess.cookie.maxAge : 86400000;
      const expired = Date.now() + maxAge;
      this.db.prepare('UPDATE sessions SET expired = ? WHERE sid = ?').run(expired, sid);
      if (callback) callback(null);
    } catch (err) {
      if (callback) callback(err);
    }
  }
}

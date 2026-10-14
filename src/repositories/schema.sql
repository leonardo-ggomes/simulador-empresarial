-- Schema do Banco de Dados Relacional - Aurora Business Lab
-- Compatível com SQLite (better-sqlite3 / node:sqlite) e migrabilidade para PostgreSQL

CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  senha_hash TEXT NOT NULL,
  nome TEXT NOT NULL,
  perfil TEXT NOT NULL CHECK(perfil IN ('aluno', 'professor', 'admin')),
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS salas (
  id TEXT PRIMARY KEY,
  codigo TEXT UNIQUE NOT NULL,
  professor_id TEXT NOT NULL,
  nome TEXT NOT NULL,
  seed TEXT NOT NULL,
  rodada_atual INTEGER NOT NULL DEFAULT 1,
  max_rodadas INTEGER NOT NULL DEFAULT 12,
  status TEXT NOT NULL CHECK(status IN ('aberta', 'em_andamento', 'encerrada')) DEFAULT 'aberta',
  configuracoes_json TEXT NOT NULL DEFAULT '{}',
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (professor_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS equipes (
  id TEXT PRIMARY KEY,
  sala_id TEXT NOT NULL,
  nome TEXT NOT NULL,
  slogan TEXT,
  avatar_url TEXT,
  setor TEXT NOT NULL DEFAULT 'Varejo & Bens de Consumo',
  cnpj TEXT UNIQUE NOT NULL,
  confirmado INTEGER NOT NULL DEFAULT 0,
  capital_social REAL NOT NULL DEFAULT 80000.0,
  data_abertura TEXT NOT NULL,
  pontuacao_financeira REAL NOT NULL DEFAULT 0.0,
  pontuacao_mercado REAL NOT NULL DEFAULT 0.0,
  pontuacao_analitica REAL NOT NULL DEFAULT 0.0,
  pontuacao_total REAL NOT NULL DEFAULT 0.0,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (sala_id) REFERENCES salas(id)
);

CREATE TABLE IF NOT EXISTS membros_equipe (
  id TEXT PRIMARY KEY,
  equipe_id TEXT NOT NULL,
  usuario_id TEXT NOT NULL,
  papel TEXT NOT NULL CHECK(papel IN ('CEO', 'CFO', 'CMO', 'COO', 'CDO')),
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(equipe_id, usuario_id, papel),
  FOREIGN KEY (equipe_id) REFERENCES equipes(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS noticias_sala (
  id TEXT PRIMARY KEY,
  sala_id TEXT NOT NULL,
  rodada_publicacao INTEGER NOT NULL,
  rodada_efeito_inicio INTEGER NOT NULL,
  duracao_rodadas INTEGER NOT NULL DEFAULT 1,
  titulo TEXT NOT NULL,
  texto TEXT NOT NULL,
  categoria TEXT NOT NULL,
  alvo TEXT NOT NULL DEFAULT 'mercado',
  impacto_real REAL NOT NULL,
  confiabilidade REAL NOT NULL,
  tipo_efeito TEXT NOT NULL,
  gerada_por TEXT NOT NULL DEFAULT 'template',
  revelada INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (sala_id) REFERENCES salas(id)
);

CREATE TABLE IF NOT EXISTS decisoes_rodada (
  id TEXT PRIMARY KEY,
  sala_id TEXT NOT NULL,
  equipe_id TEXT NOT NULL,
  rodada INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('rascunho', 'enviada')) DEFAULT 'rascunho',
  payload_json TEXT NOT NULL,
  justificativa_analitica_json TEXT,
  enviado_por TEXT,
  enviado_em TEXT,
  UNIQUE(sala_id, equipe_id, rodada),
  FOREIGN KEY (sala_id) REFERENCES salas(id),
  FOREIGN KEY (equipe_id) REFERENCES equipes(id)
);

CREATE TABLE IF NOT EXISTS resultados_rodada (
  id TEXT PRIMARY KEY,
  sala_id TEXT NOT NULL,
  equipe_id TEXT NOT NULL,
  rodada INTEGER NOT NULL,
  dre_json TEXT NOT NULL,
  balanco_json TEXT NOT NULL,
  dfc_json TEXT NOT NULL,
  mercado_json TEXT NOT NULL,
  estoque_json TEXT NOT NULL,
  credit_json TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(sala_id, equipe_id, rodada),
  FOREIGN KEY (sala_id) REFERENCES salas(id),
  FOREIGN KEY (equipe_id) REFERENCES equipes(id)
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY,
  sala_id TEXT NOT NULL,
  equipe_id TEXT NOT NULL,
  rodada INTEGER NOT NULL,
  descricao TEXT NOT NULL,
  debits_json TEXT NOT NULL,
  credits_json TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (sala_id) REFERENCES salas(id),
  FOREIGN KEY (equipe_id) REFERENCES equipes(id)
);

CREATE TABLE IF NOT EXISTS logs_analiticos (
  id TEXT PRIMARY KEY,
  sala_id TEXT NOT NULL,
  equipe_id TEXT NOT NULL,
  usuario_id TEXT NOT NULL,
  rodada INTEGER NOT NULL,
  tipo_analise TEXT NOT NULL CHECK(tipo_analise IN ('descritiva', 'diagnostica', 'preditiva', 'prescritiva')),
  detalhes_json TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (sala_id) REFERENCES salas(id),
  FOREIGN KEY (equipe_id) REFERENCES equipes(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS conquistas_equipe (
  id TEXT PRIMARY KEY,
  equipe_id TEXT NOT NULL,
  codigo_conquista TEXT NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  rodada_desbloqueio INTEGER NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(equipe_id, codigo_conquista),
  FOREIGN KEY (equipe_id) REFERENCES equipes(id)
);

CREATE INDEX IF NOT EXISTS idx_equipes_sala ON equipes(sala_id);
CREATE INDEX IF NOT EXISTS idx_decisoes_sala_rodada ON decisoes_rodada(sala_id, rodada);
CREATE INDEX IF NOT EXISTS idx_resultados_sala_rodada ON resultados_rodada(sala_id, rodada);
CREATE INDEX IF NOT EXISTS idx_logs_analiticos_equipe ON logs_analiticos(equipe_id, rodada);

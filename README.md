# Aurora Business Lab • Porto Aurora 2031

> Simulador empresarial multiplayer voltado ao ensino prático de **tomada de decisão corporativa**, **contabilidade gerencial** e **engenharia/modelagem de dados com Power BI**.

---

## ⚡ Instalação Rápida

### Pré-requisitos
- **Node.js**: versão `18.0.0` ou superior (testado com Node v20/v24).
- **NPM**: gerenciador de pacotes padrão.

### Passo a Passo

```bash
# 1. Clone o repositório ou acesse a pasta do projeto
cd simulador

# 2. Instale as dependências
npm install

# 3. Inicie em modo de desenvolvimento (live reload)
npm run dev

# 4. Ou inicie em modo de produção
npm start
```

Acesse no navegador: **`http://localhost:3000`**

### Testes Automatizados

```bash
# Executa a suíte de testes (Vitest)
npm test

# Modo interativo (watch)
npm run test:watch
```

---

## 🗺️ Mapa de Funcionalidades

| Módulo | Rota | Descrição |
|---|---|---|
| **Lobby & Autenticação** | `/lobby` · `/auth/login` | Gestão de sessões, perfis (Professor/Aluno) e seleção de salas ativas. |
| **Onboarding Corporativo** | `/sala/:id/onboarding` | Constituição da empresa: CNPJ válido, capital social inicial (R$ 80k), slogan e papéis da diretoria (CEO, CMO, COO, CFO). |
| **Gazeta Aurora** | `/sala/:id/gazeta` | Portal de notícias financeiras com ticker em tempo real, apuração de fontes e impactos econômicos (juros, câmbio, demanda). |
| **Painel de Decisões** | `/sala/:id/decisoes` | Cockpit executivo slim dividido por diretorias: CMO (Preço e Marketing), COO (Suprimentos normal e emergencial) e CFO (Crédito Banco Aurora). |
| **Galpão 3D (CAD)** | `/sala/:id/galpao` | Gêmeo digital wireframe em Three.js: porta-paletes em grade, ocupação FIFO, doca de recebimento, modo tela cheia (`F`) e telemetria. |
| **Power BI & Star Schema** | `/sala/:id/powerbi` | Central de exportação distribuída em 5 formatos (CSV, TXT, SQL, XLS, JSON API Web) para cruzamento e modelagem analítica. |
| **Demonstrativos** | `/sala/:id/resultados` | DRE Sintética, Balanço Patrimonial e DFC fechados com validação estrita de partida dobrada (`ativo == passivo + PL`). |
| **Ranking Corporativo** | `/sala/:id/ranking` | Leaderboard ponderado (50% Fin, 20% Mkt, 30% Risco), pódio Top 3, deltas de posição e gaveta de raio-x da concorrência. |
| **Painel do Facilitador** | `/sala/:id/professor` | Cockpit do professor: acompanhamento de entregas, bots autônomos de IA e disparador de simulação de rodada. |

---

## 🎓 Manual de Uso — Professor / Facilitador

### 1. Criar uma Nova Sala
1. Faça login com perfil **Professor** ou crie sua conta na tela de autenticação.
2. No Lobby, clique em **"Criar Nova Sala"**.
3. Defina o nome da turma, limite de rodadas (padrão: 12 trimestres) e o nível de dificuldade.
4. O sistema gera automaticamente um **código de acesso** (ex: `AURX92`) e semeia as notícias do cenário macroeconômico.

### 2. Acompanhar a Turma
- No menu superior, acesse **`Controle`** (`/sala/:id/professor`).
- Visualize a lista de empresas cadastradas, membros de cada equipe e status da decisão:
  - 🟡 **Rascunho:** A equipe está editando os valores.
  - 🟢 **Enviada:** Decisão formal submetida para o trimestre.
  - 🤖 **Bots de IA:** Adicione concorrentes artificiais para equilibrar a concorrência de mercado.

### 3. Conduzir e Avançar a Rodada
1. Quando as equipes tiverem submetido suas decisões, clique em **"Processar Rodada [N]"**.
2. O motor econômico calcula em lote:
   - Elasticidade e distribuição de demanda com base em preço e marketing.
   - Atendimento de pedidos, rupturas e obsolescência de estoque.
   - Livro-razão contábil, conciliação de caixa e score de crédito Banco Aurora.
3. O servidor emite evento via WebSocket (`resultado:publicar`), notificando todos os alunos simultaneamente.

---

## 💼 Manual de Uso — Aluno / Diretoria Executiva

### 1. Entrada na Sala & Constituição da Empresa
1. Faça login como **Aluno** e insira o código fornecido pelo professor.
2. Na tela de Onboarding, registre sua empresa:
   - Defina **Nome Corporativo**, **Slogan** e **Setor**.
   - O sistema gera um CNPJ alfanumérico fiscalmente válido e integraliza **R$ 80.000,00** de Capital Social em caixa.
   - Distribua os papéis entre os colegas: **CEO**, **CMO**, **COO** e **CFO**.

### 2. Ciclo de Decisão Trimestral (Passo a Passo Recomendado)

```
[1. Briefing & Gazeta] ➜ [2. Galpão 3D & Decisões] ➜ [3. Envio Formal] ➜ [4. Power BI & DRE]
```

1. **Leitura de Cenário (`Gazeta` & `Briefing`):**
   - Inspecione a Selic trimestral, variação cambial, inflação e notícias com impacto de curto prazo no custo de matéria-prima.
2. **Avaliação Física do Estoque (`Galpão 3D`):**
   - Acesse `Mais ▾` ➜ `Galpão 3D` para checar slots livres, perdas por obsolescência e pedidos chegando na doca. Use a tecla **`F`** para expandir em tela cheia.
3. **Cockpit Executivo (`Decisões`):**
   - **CMO:** Ajuste Preço unitário e verba de Marketing.
   - **COO:** Planeje compra normal (chega na próxima rodada) ou urgente (pronta entrega com ágio logístico de +30%).
   - **CFO:** Simule empréstimos de capital de giro ou amortização conforme rating Banco Aurora.
4. **Envio da Decisão:**
   - Revise a prévia de impacto no dock inferior e clique em **"Submeter Decisão à Diretoria"**.

### 3. Análise dos Resultados e Engenharia de Dados
- **Demonstrativos:** Acesse `Mais ▾` ➜ `Demonstrativos` para auditar a DRE Sintética e o Balanço Patrimonial fechado da rodada anterior.
- **Power BI:** Acesse a aba **`Power BI`** para baixar os dados distribuídos do seu negócio:
  - `fato_vendas.csv` · `dim_estoque.txt` · `livro_diario.sql` · `concorrentes.xlsx` · API Web Macro (JSON).
  - Conecte ao Power BI Desktop e monte o modelo dimensional em **Star Schema** para responder hipóteses financeiras.
- **Ranking:** Verifique a colocação da sua empresa no leaderboard corporativo e abra o **Raio-X** para inspecionar concorrentes.

---

## 📐 Critérios Oficiais de Avaliação (Ranking)

O Score Global corporativo (0 a 100 pts) é composto por três pilares:

```
Score = (Financeiro × 0.50) + (Mercado × 0.20) + (Governança × 0.30)
```

- **50% Desempenho Financeiro:** Lucro líquido acumulado, preservação de caixa livre e patrimônio líquido.
- **20% Mercado & Clientes:** Market share médio e índice de atendimento (ausência de rupturas de estoque).
- **30% Governança & Risco:** Rating de crédito Banco Aurora (`AAA` a `E`), pontuação de crédito (0–1000) e solvência.

---

## 🛠️ Estrutura do Projeto

```
simulador/
├── public/                 # Assets estáticos
│   ├── css/aurora.css      # Design system com tokens, cards e tipografia tabular
│   └── js/warehouse3d.js   # Motor 3D Three.js do Galpão (CAD wireframe)
├── src/
│   ├── engine/             # Motores puros de simulação (sem I/O, 100% determinísticos)
│   │   ├── demand.js       # Elasticidade de preço e atratividade de marketing
│   │   ├── inventory.js    # Gestão de estoque, lead-time e obsolescência
│   │   ├── ledger.js       # Livro-razão e geração de DRE, Balanço e DFC
│   │   ├── credit.js       # Motor bancário de rating (AAA a E) e limites
│   │   └── simulation.js   # Orquestrador da rodada e garantias contábeis
│   ├── repositories/       # Camada de persistência SQLite
│   ├── routes/             # Rotas web (EJS) e endpoints de API REST
│   ├── services/           # Regras de negócio (Ranking, Galpão, Exportação, Salas)
│   ├── sockets/            # Sincronização em tempo real via Socket.IO
│   └── server.js           # Ponto de entrada Express + HTTP + WebSocket
├── views/                  # Telas server-side (EJS)
│   ├── layout.ejs          # Master layout com navegação slim e drawer GSAP
│   ├── game/               # Telas do simulador (Decisões, Galpão, Gazeta, Ranking, Power BI)
│   └── teacher/            # Painel do facilitador
└── tests/                  # Suíte de 66 testes automatizados (Vitest)
```

---

## 📄 Licença

Distribuído sob a licença **MIT**. Desenvolvido para fins educacionais e de capacitação executiva no ecossistema **Aurora Hub**.

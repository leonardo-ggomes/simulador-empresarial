/**
 * Gerador de Notícias - "Gazeta do Porto"
 * Aurora Business Lab - Porto Aurora 2031
 *
 * Suporta dois modos:
 * - Modo A: Templates parametrizados de alta fidelidade
 * - Modo B (Opcional): LLM para redação de texto jornalístico a partir de parâmetros de efeito definidos pelo servidor.
 *
 * REGRA INEGOCIÁVEL: O servidor é a fonte única da verdade econômica.
 * O LLM NUNCA decide o impacto, a confiabilidade ou o tipo de efeito.
 * Se o LLM falhar ou não houver chave, fallback automático para Modo A.
 */

import { NEWS_TEMPLATES, NEWS_CATEGORIES, EFFECT_TYPES } from '../engine/news.js';
import { SeededRNG } from '../utils/rng.js';

export class NewsGeneratorService {
  /**
   * @param {object} [config]
   * @param {string} [config.llmApiKey] Chave opcional de API (OpenAI ou Gemini)
   * @param {string} [config.llmProvider] 'openai' | 'gemini' | 'mock'
   */
  constructor(config = {}) {
    this.llmApiKey = config.llmApiKey || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || null;
    this.llmProvider = config.llmProvider || (process.env.GEMINI_API_KEY ? 'gemini' : (process.env.OPENAI_API_KEY ? 'openai' : 'none'));
  }

  /**
   * Gera uma notícia completa no Modo A (Templates Parametrizados).
   *
   * @param {object} params
   * @param {string} params.salaId
   * @param {number} params.rodada
   * @param {string|number} params.seed
   * @param {string} [params.categoria]
   * @param {string} [params.dificuldade] 'iniciante' | 'intermediario' | 'avancado'
   * @returns {object} Notícia estruturada pronta para persistência
   */
  generateTemplateNews({
    salaId,
    rodada,
    seed,
    categoria = null,
    dificuldade = 'intermediario'
  }) {
    const rng = new SeededRNG(`news_gen_r${rodada}_${seed}`);

    // Filtra templates por categoria se solicitado, ou escolhe entre todos
    let candidatos = categoria
      ? NEWS_TEMPLATES.filter(t => t.categoria === categoria)
      : NEWS_TEMPLATES;

    if (candidatos.length === 0) candidatos = NEWS_TEMPLATES;

    const template = candidatos[Math.floor(rng.next() * candidatos.length)];

    // Variação estocástica controlada de impacto real dentro do range [-0.30, +0.30]
    const deltaImpacto = rng.range(-0.04, 0.04);
    let impactoReal = Number((template.impacto_padrao + deltaImpacto).toFixed(2));
    impactoReal = Math.max(-0.30, Math.min(0.30, impactoReal));

    // Confiabilidade ajustada pela dificuldade da sala
    let confiabilidade = template.confiabilidade_padrao;
    if (dificuldade === 'iniciante') {
      confiabilidade = 1.0;
    } else if (dificuldade === 'avancado') {
      confiabilidade = Number(Math.max(0.50, template.confiabilidade_padrao - rng.range(0.05, 0.20)).toFixed(2));
    }

    const newsId = `news_${salaId}_r${rodada}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

    return {
      id: newsId,
      sala_id: salaId,
      rodada_publicacao: rodada,
      rodada_efeito_inicio: rodada,
      duracao_rodadas: template.duracao_padrao,
      titulo: template.titulo,
      texto: template.texto,
      categoria: template.categoria,
      alvo: 'mercado',
      impacto_real: impactoReal,
      confiabilidade,
      tipo_efeito: template.tipo_efeito,
      gerada_por: 'template',
      revelada: false
    };
  }

  /**
   * Gera uma notícia no Modo B (com redação de LLM quando disponível e fallback automático).
   *
   * @param {object} params
   * @returns {Promise<object>}
   */
  async generateNewsWithLLM(params) {
    // 1. O SERVIDOR define rigorosamente o efeito econômico primeiro
    const templateBase = this.generateTemplateNews(params);

    // Se não há provedor configurado, retorna diretamente o Modo A
    if (!this.llmApiKey || this.llmProvider === 'none') {
      return templateBase;
    }

    try {
      // 2. Chama o LLM apenas para redigir título e texto condizentes com o impacto estabelecido
      const prompt = `Você é o editor do jornal econômico "Gazeta do Porto", situado no ano 2031 na cidade portuária de Porto Aurora.
Escreva uma manchete curta e uma notícia concisa (máximo 3 frases) com tom leve, profissional e realista.

Parâmetros econômicos rígidos definidos pelo simulador (NÃO ALTERE):
- Categoria: ${templateBase.categoria}
- Efeito Econômico: ${templateBase.tipo_efeito}
- Impacto Real no Mercado: ${(templateBase.impacto_real * 100).toFixed(1)}%
- Grau de Confiabilidade da Manchete: ${(templateBase.confiabilidade * 100).toFixed(0)}% (${templateBase.confiabilidade < 0.70 ? 'Boato/Rumor' : 'Fato Confirmado'})

Responda ESTRITAMENTE em formato JSON:
{
  "titulo": "Manchete jornalística atraente",
  "texto": "Corpo da notícia de 2 a 3 frases explicando o ocorrido em Porto Aurora."
}`;

      const llmResult = await this._callLLMProvider(prompt);

      if (llmResult && llmResult.titulo && llmResult.texto) {
        return {
          ...templateBase,
          titulo: String(llmResult.titulo).trim(),
          texto: String(llmResult.texto).trim(),
          gerada_por: 'llm'
        };
      }

      // Fallback para template se o resultado não tiver o schema esperado
      return templateBase;
    } catch (err) {
      console.warn('Fallback automático para template: falha na chamada do LLM:', err.message);
      return templateBase;
    }
  }

  /**
   * Chamada mock/real de integração com LLM com tratamento de timeout e erros.
   */
  async _callLLMProvider(prompt) {
    if (this.llmProvider === 'mock') {
      return {
        titulo: 'Gazeta do Porto: Movimentação expressiva no terminal de cargas',
        texto: 'Especialistas avaliam que os desdobramentos recentes devem impactar o ambiente de negócios porto-auroriano nas próximas semanas.'
      };
    }

    // Se houver chamada HTTP real para Gemini ou OpenAI, trata com timeout de 5 segundos
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      // Endpoint OpenAI compatível ou Gemini
      if (this.llmProvider === 'openai') {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.llmApiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' }
          }),
          signal: controller.signal
        });

        const json = await res.json();
        return JSON.parse(json.choices[0].message.content);
      }

      // Provedor não suportado ou erro de configuração: fallback
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}

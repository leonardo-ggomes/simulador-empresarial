/**
 * Sistema de Notícias e Impactos Econômicos - "Gazeta do Porto"
 * Aurora Business Lab - Porto Aurora 2031
 *
 * Controla ciclo de vida das notícias, decaimento linear,
 * cálculo multiplicativo de impactos e templates narrativos.
 */

export const NEWS_CATEGORIES = {
  MACRO: 'macro',
  LOGISTICA_PORTO: 'logistica_porto',
  CREDITO: 'credito',
  CONSUMO: 'consumo',
  CONCORRENCIA: 'concorrencia'
};

export const EFFECT_TYPES = {
  DEMANDA: 'demanda',               // Altera volume total de demanda
  ELASTICIDADE: 'elasticidade',     // Torna o consumidor mais/menos sensível a preço
  CUSTO: 'custo',                   // Afeta custos de matéria-prima e frete
  CREDITO_JUROS: 'credito_juros'    // Afeta taxa de juros bancária ou liquidez
};

export const NEWS_TEMPLATES = [
  // 1. Logística / Porto
  {
    id: 'tmpl_porto_1',
    categoria: NEWS_CATEGORIES.LOGISTICA_PORTO,
    tipo_efeito: EFFECT_TYPES.DEMANDA,
    titulo: 'Modernização no Porto de Aurora acelera fluxo de mercadorias',
    texto: 'Novos guindastes automatizados aumentam a capacidade de distribuição de produtos na região.',
    impacto_padrao: 0.15,
    confiabilidade_padrao: 0.95,
    duracao_padrao: 2
  },
  {
    id: 'tmpl_porto_2',
    categoria: NEWS_CATEGORIES.LOGISTICA_PORTO,
    tipo_efeito: EFFECT_TYPES.CUSTO,
    titulo: 'Greve de operadores alfandegários gera filas e encarece fretes em Porto Aurora',
    texto: 'Contêineres parados no pátio elevam custos extras de despacho e matérias-primas importadas.',
    impacto_padrao: 0.20,
    confiabilidade_padrao: 0.85,
    duracao_padrao: 2
  },
  {
    id: 'tmpl_porto_3',
    categoria: NEWS_CATEGORIES.LOGISTICA_PORTO,
    tipo_efeito: EFFECT_TYPES.DEMANDA,
    titulo: 'Frente fria e ressaca interditam canal de atracação por 48 horas',
    texto: 'Atrasos pontuais no recebimento de cargas devem gerar pequenos descompassos logísticos.',
    impacto_padrao: -0.08,
    confiabilidade_padrao: 0.70,
    duracao_padrao: 1
  },
  {
    id: 'tmpl_porto_4',
    categoria: NEWS_CATEGORIES.LOGISTICA_PORTO,
    tipo_efeito: EFFECT_TYPES.CUSTO,
    titulo: 'Inauguração de nova rodovia perimetral barateia frete intermodal',
    texto: 'Transportadoras estimam alívio de custos de transporte com rota expressa ao centro atacadista.',
    impacto_padrao: -0.12,
    confiabilidade_padrao: 0.90,
    duracao_padrao: 3
  },

  // 2. Macroeconomia
  {
    id: 'tmpl_macro_1',
    categoria: NEWS_CATEGORIES.MACRO,
    tipo_efeito: EFFECT_TYPES.DEMANDA,
    titulo: 'Aurora Hub anuncia aporte recorde em infraestrutura urbana e turismo',
    texto: 'Injeção de recursos públicos impulsiona renda e confiança das famílias porto-aurorianas.',
    impacto_padrao: 0.18,
    confiabilidade_padrao: 0.90,
    duracao_padrao: 3
  },
  {
    id: 'tmpl_macro_2',
    categoria: NEWS_CATEGORIES.MACRO,
    tipo_efeito: EFFECT_TYPES.ELASTICIDADE,
    titulo: 'Famílias aumentam cautela com orçamento e pesquisam mais preços',
    texto: 'Consumidores estão mais sensíveis a reajustes de preços em bens de consumo duráveis.',
    impacto_padrao: 0.25, // Aumenta elasticidade (mais sensível)
    confiabilidade_padrao: 0.85,
    duracao_padrao: 2
  },
  {
    id: 'tmpl_macro_3',
    categoria: NEWS_CATEGORIES.MACRO,
    tipo_efeito: EFFECT_TYPES.CUSTO,
    titulo: 'Instabilidade cambial internacional pressiona insumos manufaturados',
    texto: 'Moedas fortes no exterior elevam preços de componentes e embalagens industriais.',
    impacto_padrao: 0.15,
    confiabilidade_padrao: 0.80,
    duracao_padrao: 2
  },
  {
    id: 'tmpl_macro_4',
    categoria: NEWS_CATEGORIES.MACRO,
    tipo_efeito: EFFECT_TYPES.DEMANDA,
    titulo: 'Boato de crise energética assusta setor produtivo, mas concessionária nega apagão',
    texto: 'Informações conflitantes circulam entre os círculos de empresários da zona industrial.',
    impacto_padrao: -0.05,
    confiabilidade_padrao: 0.50, // Boato / baixa confiabilidade
    duracao_padrao: 1
  },

  // 3. Crédito & Banco Aurora
  {
    id: 'tmpl_credito_1',
    categoria: NEWS_CATEGORIES.CREDITO,
    tipo_efeito: EFFECT_TYPES.CREDITO_JUROS,
    titulo: 'Banco Aurora flexibiliza crédito semente para empresas incubadas',
    texto: 'Instituição reduz exigências de garantias e oferece carência para capital de giro.',
    impacto_padrao: -0.20, // Reduz custo de juros
    confiabilidade_padrao: 0.95,
    duracao_padrao: 2
  },
  {
    id: 'tmpl_credito_2',
    categoria: NEWS_CATEGORIES.CREDITO,
    tipo_efeito: EFFECT_TYPES.CREDITO_JUROS,
    titulo: 'Aperto na liquidez bancária: instituições endurecem análise de balanços',
    texto: 'Empresas com alto endividamento enfrentarão spreads punitivos a partir deste trimestre.',
    impacto_padrao: 0.25, // Aumenta juros
    confiabilidade_padrao: 0.88,
    duracao_padrao: 3
  },
  {
    id: 'tmpl_credito_3',
    categoria: NEWS_CATEGORIES.CREDITO,
    tipo_efeito: EFFECT_TYPES.CREDITO_JUROS,
    titulo: 'Mercado de capitais local atrai fundos anjo em busca de novas marcas',
    texto: 'Ambiente favorável estimula captação para projetos estruturados.',
    impacto_padrao: -0.10,
    confiabilidade_padrao: 0.75,
    duracao_padrao: 2
  },
  {
    id: 'tmpl_credito_4',
    categoria: NEWS_CATEGORIES.CREDITO,
    tipo_efeito: EFFECT_TYPES.CREDITO_JUROS,
    titulo: 'Rumores de insolvência de financeira regional provocam corrida bancária pontual',
    texto: 'Autoridades monetárias agem rápido para restabelecer a tranquilidade no sistema.',
    impacto_padrao: 0.05,
    confiabilidade_padrao: 0.55,
    duracao_padrao: 1
  },

  // 4. Consumo & Mercado
  {
    id: 'tmpl_consumo_1',
    categoria: NEWS_CATEGORIES.CONSUMO,
    tipo_efeito: EFFECT_TYPES.DEMANDA,
    titulo: 'Festival Gastronômico e Cultural de Porto Aurora bate recorde de público',
    texto: 'Forte afluxo de visitantes amplia vendas do comércio e marcas locais.',
    impacto_padrao: 0.22,
    confiabilidade_padrao: 0.92,
    duracao_padrao: 1
  },
  {
    id: 'tmpl_consumo_2',
    categoria: NEWS_CATEGORIES.CONSUMO,
    tipo_efeito: EFFECT_TYPES.DEMANDA,
    titulo: 'Pesquisa aponta valorização de marcas transparentes e bem avaliadas no pós-venda',
    texto: 'Consumidores de Porto Aurora priorizam reputação e consistência na entrega.',
    impacto_padrao: 0.10,
    confiabilidade_padrao: 0.85,
    duracao_padrao: 3
  },
  {
    id: 'tmpl_consumo_3',
    categoria: NEWS_CATEGORIES.CONSUMO,
    tipo_efeito: EFFECT_TYPES.DEMANDA,
    titulo: 'Vazamento em rede social especula substituto genérico de produtos tradicionais',
    texto: 'Analistas consideram o rumor infundado, sem impacto mensurável de mercado.',
    impacto_padrao: 0.00, // Notícia de Ruído (sem efeito)
    confiabilidade_padrao: 0.50,
    duracao_padrao: 1
  },
  {
    id: 'tmpl_consumo_4',
    categoria: NEWS_CATEGORIES.CONSUMO,
    tipo_efeito: EFFECT_TYPES.ELASTICIDADE,
    titulo: 'Boom de campanhas digitais satura atenção do consumidor local',
    texto: 'Eficácia do marketing tradicional exige maior criatividade e precisão analítica.',
    impacto_padrao: -0.15, // Marketing menos eficiente / consumidor mais seletivo
    confiabilidade_padrao: 0.80,
    duracao_padrao: 2
  },

  // 5. Concorrência
  {
    id: 'tmpl_conc_1',
    categoria: NEWS_CATEGORIES.CONCORRENCIA,
    tipo_efeito: EFFECT_TYPES.DEMANDA,
    titulo: 'Gigante do e-commerce adia início de operações no polo de Porto Aurora',
    texto: 'Empresas locais ganham janela estratégica de oportunidade para consolidar market share.',
    impacto_padrao: 0.16,
    confiabilidade_padrao: 0.88,
    duracao_padrao: 2
  },
  {
    id: 'tmpl_conc_2',
    categoria: NEWS_CATEGORIES.CONCORRENCIA,
    tipo_efeito: EFFECT_TYPES.ELASTICIDADE,
    titulo: 'Novos concorrentes automatizados inundam mercado com promoções agressivas',
    texto: 'Guerra de preços pressiona margens de quem não monitorar de perto os rivais.',
    impacto_padrao: 0.20,
    confiabilidade_padrao: 0.90,
    duracao_padrao: 2
  },
  {
    id: 'tmpl_conc_3',
    categoria: NEWS_CATEGORIES.CONCORRENCIA,
    tipo_efeito: EFFECT_TYPES.CUSTO,
    titulo: 'Cooperativa de compras conjuntas reduz custos de embalagem para associados',
    texto: 'Parcerias locais geram economia de escala e mitigam pressões de custos operacionais.',
    impacto_padrao: -0.10,
    confiabilidade_padrao: 0.82,
    duracao_padrao: 2
  },
  {
    id: 'tmpl_conc_4',
    categoria: NEWS_CATEGORIES.CONCORRENCIA,
    tipo_efeito: EFFECT_TYPES.DEMANDA,
    titulo: 'Auditoria fiscal interdita centro de distribuição de rival clandestino',
    texto: 'Fatia de mercado do concorrente irregular é redistribuída entre as marcas formais.',
    impacto_padrao: 0.12,
    confiabilidade_padrao: 0.95,
    duracao_padrao: 1
  }
];

export class NewsEngine {
  /**
   * @param {Array<object>} newsList
   */
  constructor(newsList = []) {
    this.newsList = [...newsList];
  }

  /**
   * Adiciona uma notícia ao sistema.
   * @param {object} newsItem
   */
  addNews(newsItem) {
    if (newsItem.impacto_real < -0.30 || newsItem.impacto_real > 0.30) {
      throw new Error(`Impacto real deve estar entre -0.30 e +0.30. Recebido: ${newsItem.impacto_real}`);
    }
    if (newsItem.confiabilidade < 0.50 || newsItem.confiabilidade > 1.00) {
      throw new Error(`Confiabilidade deve estar entre 0.50 e 1.00. Recebido: ${newsItem.confiabilidade}`);
    }
    this.newsList.push(newsItem);
  }

  /**
   * Retorna notícias publicadas até a rodada atual.
   * @param {number} round
   */
  getPublishedNews(round) {
    return this.newsList.filter(n => n.rodada_publicacao <= round);
  }

  /**
   * Calcula o decaimento linear da notícia na rodada solicitada.
   * 1ª rodada de efeito: 100% (1.0)
   * 2ª rodada: 60% (0.6)
   * 3ª rodada: 30% (0.3)
   * Após: 0%
   * @param {object} news
   * @param {number} round
   * @returns {number} Fator de decaimento (0 a 1)
   */
  static getDecayFactor(news, round) {
    const inicio = news.rodada_efeito_inicio;
    if (round < inicio) return 0;

    const delta = round - inicio; // 0 para 1ª rodada, 1 para 2ª, 2 para 3ª
    if (delta >= (news.duracao_rodadas || 1)) return 0;

    if (delta === 0) return 1.0;
    if (delta === 1) return 0.6;
    if (delta === 2) return 0.3;
    return 0;
  }

  /**
   * Calcula os multiplicadores agregados de notícias para uma dada rodada.
   * Efeitos acumulam de forma multiplicativa com piso e teto seguros:
   * Demanda: [0.60x, 1.60x]
   * Custo: [0.70x, 1.50x]
   * Elasticidade: [0.70x, 1.40x]
   * Credito Juros: [0.70x, 1.40x]
   *
   * @param {number} currentRound
   * @returns {{ multiplicadorDemanda: number, multiplicadorCusto: number, multiplicadorElasticidade: number, multiplicadorJuros: number, noticiasAtivas: Array<object> }}
   */
  calculateActiveEffects(currentRound) {
    let multDemanda = 1.0;
    let multCusto = 1.0;
    let multElasticidade = 1.0;
    let multJuros = 1.0;

    const ativas = [];

    for (const news of this.newsList) {
      const decay = NewsEngine.getDecayFactor(news, currentRound);
      if (decay <= 0) continue;

      // O impacto efetivo aplicado é o impacto_real escalado pelo decaimento
      const impactoEfetivo = news.impacto_real * decay;
      const fatorMultiplicativo = 1.0 + impactoEfetivo;

      ativas.push({
        id: news.id,
        titulo: news.titulo,
        tipo_efeito: news.tipo_efeito,
        impacto_real: news.impacto_real,
        confiabilidade: news.confiabilidade,
        decay,
        impactoEfetivo: Number(impactoEfetivo.toFixed(4)),
        fatorMultiplicativo: Number(fatorMultiplicativo.toFixed(4))
      });

      if (news.tipo_efeito === EFFECT_TYPES.DEMANDA) {
        multDemanda *= fatorMultiplicativo;
      } else if (news.tipo_efeito === EFFECT_TYPES.CUSTO) {
        multCusto *= fatorMultiplicativo;
      } else if (news.tipo_efeito === EFFECT_TYPES.ELASTICIDADE) {
        multElasticidade *= fatorMultiplicativo;
      } else if (news.tipo_efeito === EFFECT_TYPES.CREDITO_JUROS) {
        multJuros *= fatorMultiplicativo;
      }
    }

    return {
      multiplicadorDemanda: Number(Math.max(0.60, Math.min(1.60, multDemanda)).toFixed(4)),
      multiplicadorCusto: Number(Math.max(0.70, Math.min(1.50, multCusto)).toFixed(4)),
      multiplicadorElasticidade: Number(Math.max(0.70, Math.min(1.40, multElasticidade)).toFixed(4)),
      multiplicadorJuros: Number(Math.max(0.70, Math.min(1.40, multJuros)).toFixed(4)),
      noticiasAtivas: ativas
    };
  }

  /**
   * Revela o pós-rodada: compara o impacto esperado (anúncio na manchete / percepção)
   * contra o impacto real que foi computado pelo servidor.
   * @param {number} round
   */
  revealImpactsForRound(round) {
    return this.newsList
      .filter(n => n.rodada_efeito_inicio === round)
      .map(n => {
        const impactoEsperado = Number((n.impacto_real / n.confiabilidade).toFixed(3));
        return {
          id: n.id,
          titulo: n.titulo,
          categoria: n.categoria,
          tipo_efeito: n.tipo_efeito,
          impactoEsperado,
          impactoReal: n.impacto_real,
          confiabilidade: n.confiabilidade,
          diferenca: Number((n.impacto_real - impactoEsperado).toFixed(3)),
          foiBoato: n.confiabilidade < 0.70
        };
      });
  }
}

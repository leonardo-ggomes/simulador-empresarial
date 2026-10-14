import { describe, it, expect } from 'vitest';
import { NewsEngine, EFFECT_TYPES, NEWS_CATEGORIES, NEWS_TEMPLATES } from '../src/engine/news.js';

describe('Motor de Notícias ("Gazeta do Porto")', () => {
  it('deve ter pelo menos 20 templates pré-configurados por categoria', () => {
    expect(NEWS_TEMPLATES.length).toBeGreaterThanOrEqual(20);
    const categorias = new Set(NEWS_TEMPLATES.map(t => t.categoria));
    expect(categorias.size).toBeGreaterThanOrEqual(4);
  });

  it('deve obedecer ao decaimento linear estrito (100% -> 60% -> 30% -> 0%)', () => {
    const noticia = {
      id: 'noticia_teste',
      rodada_publicacao: 1,
      rodada_efeito_inicio: 2,
      duracao_rodadas: 3,
      titulo: 'Choque de infraestrutura',
      impacto_real: 0.20,
      confiabilidade: 1.0,
      tipo_efeito: EFFECT_TYPES.DEMANDA
    };

    expect(NewsEngine.getDecayFactor(noticia, 1)).toBe(0);   // Antes do efeito
    expect(NewsEngine.getDecayFactor(noticia, 2)).toBe(1.0); // 1ª rodada: 100%
    expect(NewsEngine.getDecayFactor(noticia, 3)).toBe(0.6); // 2ª rodada: 60%
    expect(NewsEngine.getDecayFactor(noticia, 4)).toBe(0.3); // 3ª rodada: 30%
    expect(NewsEngine.getDecayFactor(noticia, 5)).toBe(0);   // Expirou
  });

  it('deve acumular impactos multiplicativos com teto e piso', () => {
    const engine = new NewsEngine([
      {
        id: 'n1',
        rodada_publicacao: 1,
        rodada_efeito_inicio: 2,
        duracao_rodadas: 2,
        titulo: 'Alta forte da demanda 1',
        impacto_real: 0.25,
        confiabilidade: 0.90,
        tipo_efeito: EFFECT_TYPES.DEMANDA
      },
      {
        id: 'n2',
        rodada_publicacao: 1,
        rodada_efeito_inicio: 2,
        duracao_rodadas: 2,
        titulo: 'Alta forte da demanda 2',
        impacto_real: 0.20,
        confiabilidade: 0.90,
        tipo_efeito: EFFECT_TYPES.DEMANDA
      }
    ]);

    const efeitos = engine.calculateActiveEffects(2);
    // (1 + 0.25) * (1 + 0.20) = 1.25 * 1.20 = 1.50
    expect(efeitos.multiplicadorDemanda).toBe(1.50);
    expect(efeitos.noticiasAtivas).toHaveLength(2);
  });

  it('deve revelar o impacto real vs esperado no pós-rodada', () => {
    const engine = new NewsEngine([
      {
        id: 'boato_1',
        rodada_publicacao: 1,
        rodada_efeito_inicio: 1,
        duracao_rodadas: 1,
        titulo: 'Boato de crise energética',
        categoria: NEWS_CATEGORIES.MACRO,
        impacto_real: -0.05,
        confiabilidade: 0.50, // Confiabilidade baixa
        tipo_efeito: EFFECT_TYPES.DEMANDA
      }
    ]);

    const revelacoes = engine.revealImpactsForRound(1);
    expect(revelacoes).toHaveLength(1);
    expect(revelacoes[0].impactoReal).toBe(-0.05);
    expect(revelacoes[0].impactoEsperado).toBe(-0.10); // -0.05 / 0.50
    expect(revelacoes[0].foiBoato).toBe(true);
  });
});

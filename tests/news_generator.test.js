import { describe, it, expect } from 'vitest';
import { NewsGeneratorService } from '../src/services/newsGeneratorService.js';

describe('Gerador de Notícias ("Gazeta do Porto") - Modo A e B', () => {
  it('Modo A: deve gerar notícias válidas com templates parametrizados e limites rígidos', () => {
    const generator = new NewsGeneratorService();

    for (let r = 1; r <= 10; r++) {
      const noticia = generator.generateTemplateNews({
        salaId: 'sala_teste_noticias',
        rodada: r,
        seed: `seed_noticia_${r}`,
        dificuldade: 'intermediario'
      });

      expect(noticia.id).toBeDefined();
      expect(noticia.titulo.length).toBeGreaterThan(10);
      expect(noticia.texto.length).toBeGreaterThan(15);
      expect(noticia.impacto_real).toBeGreaterThanOrEqual(-0.30);
      expect(noticia.impacto_real).toBeLessThanOrEqual(0.30);
      expect(noticia.confiabilidade).toBeGreaterThanOrEqual(0.50);
      expect(noticia.confiabilidade).toBeLessThanOrEqual(1.00);
      expect(noticia.gerada_por).toBe('template');
    }
  });

  it('Modo B: deve utilizar LLM para redigir textos mantendo RIGOROSAMENTE os efeitos do servidor', async () => {
    // Configura gerador com provedor mock simulando LLM respondendo texto
    const generator = new NewsGeneratorService({
      llmApiKey: 'mock_key',
      llmProvider: 'mock'
    });

    const noticia = await generator.generateNewsWithLLM({
      salaId: 'sala_llm',
      rodada: 3,
      seed: 'seed_llm_3'
    });

    // O texto foi redigido pelo LLM (Modo B)
    expect(noticia.gerada_por).toBe('llm');
    expect(noticia.titulo).toContain('Gazeta do Porto');

    // REGRA DE OURO: O impacto e confiabilidade continuam definidos pelo servidor!
    expect(noticia.impacto_real).toBeGreaterThanOrEqual(-0.30);
    expect(noticia.impacto_real).toBeLessThanOrEqual(0.30);
  });

  it('Modo B Fallback: deve realizar fallback automático para template se o LLM falhar ou não houver chave', async () => {
    // Sem chave
    const generatorSemChave = new NewsGeneratorService({ llmApiKey: null, llmProvider: 'none' });
    const noticiaFallback = await generatorSemChave.generateNewsWithLLM({
      salaId: 'sala_sem_chave',
      rodada: 4,
      seed: 'seed_fallback'
    });

    expect(noticiaFallback).toBeDefined();
    expect(noticiaFallback.gerada_por).toBe('template');
    expect(noticiaFallback.titulo).toBeDefined();
    expect(noticiaFallback.impacto_real).toBeDefined();
  });
});

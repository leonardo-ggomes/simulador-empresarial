import { describe, it, expect } from 'vitest';
import { MacroEconomy, ACTS } from '../src/engine/macro.js';

describe('Motor Macroeconômico (12 Rodadas / 3 Atos)', () => {
  it('deve gerar 12 rodadas completas determinísticas para a seed', () => {
    const macro1 = new MacroEconomy('sala_porto_123');
    const macro2 = new MacroEconomy('sala_porto_123');

    for (let r = 1; r <= 12; r++) {
      const data1 = macro1.getRoundData(r);
      const data2 = macro2.getRoundData(r);
      expect(data1).toEqual(data2);
    }
  });

  it('deve categorizar corretamente os 3 Atos do Storyline', () => {
    expect(MacroEconomy.getActByRound(1)).toEqual(ACTS.ATO_1);
    expect(MacroEconomy.getActByRound(4)).toEqual(ACTS.ATO_1);
    expect(MacroEconomy.getActByRound(5)).toEqual(ACTS.ATO_2);
    expect(MacroEconomy.getActByRound(8)).toEqual(ACTS.ATO_2);
    expect(MacroEconomy.getActByRound(9)).toEqual(ACTS.ATO_3);
    expect(MacroEconomy.getActByRound(12)).toEqual(ACTS.ATO_3);
  });

  it('deve simular alta de juros e choque cambial progressivo no Ato 3', () => {
    const macro = new MacroEconomy('seed_teste');
    const r1 = macro.getRoundData(1);
    const r11 = macro.getRoundData(11);

    // No Ato 3 (Turbulência), Selic e Câmbio devem estar substancialmente mais altos
    expect(r11.selic).toBeGreaterThan(r1.selic);
    expect(r11.cambio).toBeGreaterThan(r1.cambio);
    expect(r11.fatorCambialCustoMP).toBeGreaterThan(1.0);
  });

  it('deve respeitar a sazonalidade trimestral cíclica', () => {
    const macro = new MacroEconomy('seed_sazonalidade');
    const r1 = macro.getRoundData(1); // Q1
    const r4 = macro.getRoundData(4); // Q4 (Alta)
    const r5 = macro.getRoundData(5); // Q1

    expect(r1.sazonalidade).toBe(0.95);
    expect(r4.sazonalidade).toBe(1.20);
    expect(r5.sazonalidade).toBe(0.95);
  });
});

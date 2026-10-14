import { describe, it, expect } from 'vitest';
import { gerarCNPJFicticio, validarCNPJ, formatarCNPJ } from '../src/utils/cnpj.js';

describe('Utilitário de CNPJ Fictício', () => {
  it('deve gerar CNPJs válidos e com formato oficial 00.000.000/0001-00', () => {
    for (let i = 0; i < 20; i++) {
      const { cnpj, digits, ficticio } = gerarCNPJFicticio();

      expect(ficticio).toBe(true);
      expect(digits).toHaveLength(14);
      expect(digits.slice(8, 12)).toBe('0001'); // filial padrão 0001
      expect(validarCNPJ(cnpj)).toBe(true);
      expect(validarCNPJ(digits)).toBe(true);
      expect(cnpj).toMatch(/^\d{2}\.\d{3}\.\d{3}\/0001-\d{2}$/);
    }
  });

  it('deve formatar corretamente sequências puras de 14 dígitos', () => {
    const raw = '12345678000195';
    const formatted = formatarCNPJ(raw);
    expect(formatted).toBe('12.345.678/0001-95');
  });

  it('deve rejeitar CNPJs com dígitos verificadores incorretos', () => {
    expect(validarCNPJ('12.345.678/0001-00')).toBe(false);
    expect(validarCNPJ('00.000.000/0001-99')).toBe(false);
    expect(validarCNPJ('11.111.111/1111-11')).toBe(false); // repetidos inválidos
  });

  it('deve rejeitar entradas vazias ou incompletas', () => {
    expect(validarCNPJ('')).toBe(false);
    expect(validarCNPJ(null)).toBe(false);
    expect(validarCNPJ('123')).toBe(false);
  });
});

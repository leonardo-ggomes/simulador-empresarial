/**
 * Utilitário de Geração e Validação de CNPJ com dígitos verificadores válidos.
 * Especializado para o simulador Aurora Business Lab com filial 0001 e formato oficial.
 */

/**
 * Calcula o primeiro ou segundo dígito verificador do CNPJ usando módulo 11.
 * @param {string} base - Primeiros 12 ou 13 dígitos
 * @returns {number} Dígito verificador calculado
 */
function calcularDigito(base) {
  const pesos = base.length === 12
    ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let soma = 0;
  for (let i = 0; i < base.length; i++) {
    soma += parseInt(base[i], 10) * pesos[i];
  }

  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/**
 * Formata sequência de 14 dígitos no padrão oficial: 00.000.000/0001-00
 * @param {string} digits
 * @returns {string}
 */
export function formatarCNPJ(digits) {
  const clean = String(digits).replace(/\D/g, '').padStart(14, '0');
  return clean.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5'
  );
}

/**
 * Valida se uma string é um CNPJ matematicamente válido.
 * Rejeita padrões repetidos conhecidos (ex: 11111111111111).
 * @param {string} cnpj
 * @returns {boolean}
 */
export function validarCNPJ(cnpj) {
  if (!cnpj) return false;
  const limpo = String(cnpj).replace(/\D/g, '');

  if (limpo.length !== 14) return false;

  // Rejeita sequências de dígitos todos iguais
  if (/^(\d)\1{13}$/.test(limpo)) return false;

  const base12 = limpo.slice(0, 12);
  const d1 = calcularDigito(base12);
  if (parseInt(limpo[12], 10) !== d1) return false;

  const base13 = limpo.slice(0, 12) + d1;
  const d2 = calcularDigito(base13);
  if (parseInt(limpo[13], 10) !== d2) return false;

  return true;
}

/**
 * Gera um CNPJ fictício válido com filial /0001-.
 * Pode receber um gerador de números aleatórios determinístico ou usar Math.random.
 * @param {{ next?: () => number }} [rng]
 * @returns {{ cnpj: string, digits: string, ficticio: true }}
 */
export function gerarCNPJFicticio(rng = null) {
  const randomDigit = () => {
    if (rng && typeof rng.next === 'function') {
      return Math.floor(rng.next() * 10);
    }
    return Math.floor(Math.random() * 10);
  };

  // 8 dígitos para a raiz da empresa (evita todos zeros)
  let raiz = '';
  for (let i = 0; i < 8; i++) {
    raiz += randomDigit();
  }
  if (raiz === '00000000') {
    raiz = '42189031';
  }

  // Filial padrão 0001
  const filial = '0001';
  const base12 = raiz + filial;

  const d1 = calcularDigito(base12);
  const d2 = calcularDigito(base12 + d1);

  const digits = `${base12}${d1}${d2}`;
  const cnpj = formatarCNPJ(digits);

  return {
    cnpj,
    digits,
    ficticio: true
  };
}

/**
 * Leitor de CSV sem dependências.
 * Aceita campos entre aspas, vírgula dentro de aspas e aspas escapadas ("").
 */
export function lerCsv(texto) {
  const linhas = [];
  let linha = [];
  let campo = "";
  let dentroDeAspas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];

    if (dentroDeAspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          dentroDeAspas = false;
        }
      } else {
        campo += c;
      }
      continue;
    }

    if (c === '"') {
      dentroDeAspas = true;
    } else if (c === ",") {
      linha.push(campo);
      campo = "";
    } else if (c === "\r") {
      // ignora, o \n fecha a linha
    } else if (c === "\n") {
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
    } else {
      campo += c;
    }
  }

  if (campo !== "" || linha.length > 0) {
    linha.push(campo);
    linhas.push(linha);
  }

  return linhas.filter((l) => l.some((v) => v.trim() !== ""));
}

/** Converte o CSV em objetos, usando a primeira linha como cabeçalho. */
export function produtosDeCsv(texto) {
  const [cabecalho, ...corpo] = lerCsv(texto);
  if (!cabecalho) return [];
  const colunas = cabecalho.map((c) => c.trim());

  return corpo.map((linha) => {
    const registro = {};
    colunas.forEach((coluna, indice) => {
      registro[coluna] = (linha[indice] ?? "").trim();
    });
    return {
      id: registro.id,
      nome: registro.nome,
      categoria: registro.categoria,
      descricao: registro.descricao,
      composicao: registro.composicao,
      medida: registro.medida,
      precoVista: registro.preco_vista,
      parcelas: Number(registro.parcelas || 0),
      parcelaValor: registro.parcela_valor,
      cores: (registro.cores || "").split(";").map((c) => c.trim()).filter(Boolean),
      foto: registro.foto || null,
    };
  });
}

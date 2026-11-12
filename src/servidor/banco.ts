// ============================================================
// BANCO DE DADOS — SQLite com better-sqlite3
// O arquivo tarefas.db é criado automaticamente na raiz do projeto.
// Aqui ficam as 4 operações do CRUD, escritas em SQL.
// ============================================================

import Database from "better-sqlite3";
import path from "node:path";
import { NovaTarefa, Tarefa, Status, Prioridade } from "./tipos";

const caminhoBanco = path.join(process.cwd(), "tarefas.db");
const banco = new Database(caminhoBanco);
banco.pragma("journal_mode = WAL");

// Cria a tabela na primeira execução. Os CHECK garantem no próprio banco
// o mesmo que os Union Types garantem no TypeScript.
banco.exec(`
  CREATE TABLE IF NOT EXISTS tarefas (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo     TEXT NOT NULL,
    descricao  TEXT NOT NULL DEFAULT '',
    status     TEXT NOT NULL DEFAULT 'pendente'
               CHECK (status IN ('pendente', 'em-andamento', 'concluida')),
    prioridade TEXT NOT NULL DEFAULT 'media'
               CHECK (prioridade IN ('baixa', 'media', 'alta')),
    criada_em  TEXT NOT NULL
  )
`);

// Como a linha vem do banco (colunas em snake_case)
interface LinhaTarefa {
  id: number;
  titulo: string;
  descricao: string;
  status: Status;
  prioridade: Prioridade;
  criada_em: string;
}

// Converte linha do banco -> objeto Tarefa
function paraTarefa(linha: LinhaTarefa): Tarefa {
  return {
    id: linha.id,
    titulo: linha.titulo,
    descricao: linha.descricao,
    status: linha.status,
    prioridade: linha.prioridade,
    criadaEm: linha.criada_em,
  };
}

// ---------- CRUD ----------

// READ: todas as tarefas
export function listarTarefas(): Tarefa[] {
  const linhas = banco
    .prepare("SELECT * FROM tarefas ORDER BY criada_em DESC, id DESC")
    .all() as LinhaTarefa[];
  return linhas.map(paraTarefa);
}

// READ: uma tarefa pelo id
export function buscarTarefa(id: number): Tarefa | undefined {
  const linha = banco
    .prepare("SELECT * FROM tarefas WHERE id = ?")
    .get(id) as LinhaTarefa | undefined;
  return linha ? paraTarefa(linha) : undefined;
}

// CREATE
export function criarTarefa(dados: NovaTarefa): Tarefa {
  const resultado = banco
    .prepare(
      `INSERT INTO tarefas (titulo, descricao, status, prioridade, criada_em)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(dados.titulo, dados.descricao, dados.status, dados.prioridade, dados.criadaEm);

  // lastInsertRowid é o id que o banco acabou de gerar
  return buscarTarefa(Number(resultado.lastInsertRowid)) as Tarefa;
}

// UPDATE: recebe só os campos que mudaram
export function atualizarTarefa(id: number, mudancas: Partial<NovaTarefa>): Tarefa | undefined {
  const atual = buscarTarefa(id);
  if (!atual) return undefined;

  const nova = { ...atual, ...mudancas };
  banco
    .prepare(
      `UPDATE tarefas
          SET titulo = ?, descricao = ?, status = ?, prioridade = ?
        WHERE id = ?`
    )
    .run(nova.titulo, nova.descricao, nova.status, nova.prioridade, id);

  return buscarTarefa(id);
}

// DELETE: devolve true se alguma linha foi removida
export function removerTarefa(id: number): boolean {
  const resultado = banco.prepare("DELETE FROM tarefas WHERE id = ?").run(id);
  return resultado.changes > 0;
}

// Dados de exemplo para o primeiro uso (só se a tabela estiver vazia)
export function criarExemplosSeVazio(): void {
  const { total } = banco.prepare("SELECT COUNT(*) AS total FROM tarefas").get() as {
    total: number;
  };
  if (total > 0) return;

  const agora = new Date().toISOString();
  criarTarefa({
    titulo: "Revisar Union Types",
    descricao: "Treinar com status e prioridade das tarefas.",
    status: "pendente",
    prioridade: "media",
    criadaEm: agora,
  });
  criarTarefa({
    titulo: "Estudar métodos de array",
    descricao: "filter, find, map e reduce com exemplos reais.",
    status: "em-andamento",
    prioridade: "alta",
    criadaEm: agora,
  });
  criarTarefa({
    titulo: "Conectar o projeto a um banco de dados",
    descricao: "SQLite + Express com TypeScript.",
    status: "concluida",
    prioridade: "baixa",
    criadaEm: agora,
  });
}

// ============================================================
// SERVIDOR — Express (API REST) + arquivos do front end
//
//   GET    /api/tarefas        lista todas
//   POST   /api/tarefas        cria uma
//   PUT    /api/tarefas/:id    atualiza uma
//   DELETE /api/tarefas/:id    remove uma
// ============================================================

import express, { NextFunction, Request, Response } from "express";
import path from "node:path";
import {
  atualizarTarefa,
  criarExemplosSeVazio,
  criarTarefa,
  listarTarefas,
  removerTarefa,
} from "./banco";
import { NovaTarefa, ehPrioridade, ehStatus } from "./tipos";

const PORTA = Number(process.env.PORT) || 3000;

const app = express();
app.use(express.json());
app.use(express.static(path.join(process.cwd(), "public")));

// ---------- Validação ----------

type ResultadoValidacao = { dados: Partial<NovaTarefa> } | { erro: string };

// Confere o corpo da requisição. Em "parcial" (PUT) todos os campos são opcionais.
function validarCorpo(corpo: unknown, parcial: boolean): ResultadoValidacao {
  if (typeof corpo !== "object" || corpo === null) {
    return { erro: "Corpo da requisição inválido." };
  }
  const c = corpo as Record<string, unknown>;
  const dados: Partial<NovaTarefa> = {};

  if (c.titulo !== undefined || !parcial) {
    if (typeof c.titulo !== "string" || c.titulo.trim() === "") {
      return { erro: "O título é obrigatório." };
    }
    dados.titulo = c.titulo.trim().slice(0, 80);
  }

  if (c.descricao !== undefined) {
    if (typeof c.descricao !== "string") return { erro: "Descrição inválida." };
    dados.descricao = c.descricao.trim().slice(0, 200);
  } else if (!parcial) {
    dados.descricao = "";
  }

  if (c.prioridade !== undefined) {
    if (!ehPrioridade(c.prioridade)) return { erro: "Prioridade inválida." };
    dados.prioridade = c.prioridade;
  } else if (!parcial) {
    dados.prioridade = "media";
  }

  if (c.status !== undefined) {
    if (!ehStatus(c.status)) return { erro: "Status inválido." };
    dados.status = c.status;
  } else if (!parcial) {
    dados.status = "pendente";
  }

  if (c.criadaEm !== undefined) {
    if (typeof c.criadaEm !== "string" || Number.isNaN(Date.parse(c.criadaEm))) {
      return { erro: "Data inválida." };
    }
    dados.criadaEm = c.criadaEm;
  } else if (!parcial) {
    dados.criadaEm = new Date().toISOString();
  }

  return { dados };
}

function lerId(req: Request): number | null {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// ---------- Rotas ----------

app.get("/api/tarefas", (_req: Request, res: Response) => {
  res.json(listarTarefas());
});

app.post("/api/tarefas", (req: Request, res: Response) => {
  const resultado = validarCorpo(req.body, false);
  if ("erro" in resultado) {
    res.status(400).json({ erro: resultado.erro });
    return;
  }
  const criada = criarTarefa(resultado.dados as NovaTarefa);
  res.status(201).json(criada);
});

app.put("/api/tarefas/:id", (req: Request, res: Response) => {
  const id = lerId(req);
  if (id === null) {
    res.status(400).json({ erro: "Id inválido." });
    return;
  }
  const resultado = validarCorpo(req.body, true);
  if ("erro" in resultado) {
    res.status(400).json({ erro: resultado.erro });
    return;
  }
  const atualizada = atualizarTarefa(id, resultado.dados);
  if (!atualizada) {
    res.status(404).json({ erro: "Tarefa não encontrada." });
    return;
  }
  res.json(atualizada);
});

app.delete("/api/tarefas/:id", (req: Request, res: Response) => {
  const id = lerId(req);
  if (id === null) {
    res.status(400).json({ erro: "Id inválido." });
    return;
  }
  if (!removerTarefa(id)) {
    res.status(404).json({ erro: "Tarefa não encontrada." });
    return;
  }
  res.status(204).end();
});

// Qualquer erro inesperado vira uma resposta 500 em JSON
app.use((erro: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(erro);
  res.status(500).json({ erro: "Erro interno do servidor." });
});

// ---------- Início ----------

criarExemplosSeVazio();
app.listen(PORTA, () => {
  console.log(`Servidor rodando em http://localhost:${PORTA}`);
});

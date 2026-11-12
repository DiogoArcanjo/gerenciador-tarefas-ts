// Tipos compartilhados pelo servidor (mesmos conceitos que você já estudou)

export type Status = "pendente" | "em-andamento" | "concluida";
export type Prioridade = "baixa" | "media" | "alta";

// Uma tarefa como o front end enxerga
export interface Tarefa {
  id: number;
  titulo: string;
  descricao: string;
  status: Status;
  prioridade: Prioridade;
  criadaEm: string;
}

// Dados necessários para criar uma tarefa (o id é gerado pelo banco)
export type NovaTarefa = Omit<Tarefa, "id">;

export function ehStatus(valor: unknown): valor is Status {
  return valor === "pendente" || valor === "em-andamento" || valor === "concluida";
}

export function ehPrioridade(valor: unknown): valor is Prioridade {
  return valor === "baixa" || valor === "media" || valor === "alta";
}

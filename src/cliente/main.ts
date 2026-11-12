// ============================================================
// GERENCIADOR DE TAREFAS — FRONT END (TypeScript + DOM)
// Agora os dados vivem no banco de dados (SQLite). Este arquivo
// conversa com o servidor usando fetch() e async/await.
// ============================================================

// ---------- 1. TIPOS ----------

// Union Types: só estes valores são aceitos pelo TypeScript
type Status = "pendente" | "em-andamento" | "concluida";
type Prioridade = "baixa" | "media" | "alta";
type FiltroPrioridade = Prioridade | "todas";

// Interface: o "molde" de uma tarefa
interface Tarefa {
  id: number;
  titulo: string;
  descricao: string;
  status: Status;
  prioridade: Prioridade;
  criadaEm: string; // data em formato ISO
}

// Dados que o usuário informa (o id e a data são gerados pelo sistema)
interface DadosTarefa {
  titulo: string;
  descricao: string;
  prioridade: Prioridade;
  status?: Status;
  criadaEm?: string; // usado ao desfazer uma exclusão
}

// Uma ação possível em um card: texto do botão + novo status
interface AcaoStatus {
  rotulo: string;
  destino: Status;
}

// ---------- 2. CONSTANTES ----------

const COLUNAS: Status[] = ["pendente", "em-andamento", "concluida"];

const ROTULOS_STATUS: Record<Status, string> = {
  "pendente": "Pendentes",
  "em-andamento": "Em andamento",
  "concluida": "Concluídas",
};

const ROTULOS_PRIORIDADE: Record<Prioridade, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

const MENSAGENS_VAZIO: Record<Status, string> = {
  "pendente": "Nada na fila. Adicione uma tarefa ao lado.",
  "em-andamento": "Nenhuma tarefa em andamento.",
  "concluida": "Ainda não há tarefas concluídas.",
};

// Quais botões aparecem em cada coluna
const ACOES: Record<Status, AcaoStatus[]> = {
  "pendente": [{ rotulo: "Iniciar", destino: "em-andamento" }],
  "em-andamento": [
    { rotulo: "Voltar", destino: "pendente" },
    { rotulo: "Concluir", destino: "concluida" },
  ],
  "concluida": [{ rotulo: "Reabrir", destino: "em-andamento" }],
};

// ---------- 3. ESTADO (os dados ficam em memória) ----------

// Cópia local da lista, só para desenhar a tela. A fonte da verdade é o banco.
let tarefas: Tarefa[] = [];
let termoBusca = "";
let filtroPrioridade: FiltroPrioridade = "todas";
let idEmEdicao: number | null = null;
let ultimaExcluida: Tarefa | null = null;
let temporizadorToast: number | undefined;

// ---------- 4. COMUNICAÇÃO COM A API ----------

// Função genérica: faz a requisição e devolve os dados já tipados (T)
async function requisitar<T>(caminho: string, metodo = "GET", corpo?: unknown): Promise<T> {
  const resposta = await fetch(caminho, {
    method: metodo,
    headers: corpo !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
  });

  if (!resposta.ok) {
    const detalhe = await resposta.json().catch(() => ({ erro: "Erro desconhecido." }));
    throw new Error(detalhe.erro ?? "Erro desconhecido.");
  }

  if (resposta.status === 204) return undefined as T;
  return resposta.json() as Promise<T>;
}

// ---------- 5. CRUD (cada função chama o servidor) ----------

// READ: busca tudo no banco e guarda na lista local
async function carregarTarefas(): Promise<void> {
  tarefas = await requisitar<Tarefa[]>("/api/tarefas");
}

// CREATE
async function adicionarTarefa(dados: DadosTarefa): Promise<Tarefa> {
  return requisitar<Tarefa>("/api/tarefas", "POST", dados);
}

// READ (na lista local)
function buscarPorId(id: number): Tarefa | undefined {
  return tarefas.find((t) => t.id === id);
}

// READ (filtros aplicados na lista local)
function listarPorStatus(status: Status): Tarefa[] {
  const termo = termoBusca.trim().toLowerCase();

  return tarefas.filter((t) => {
    const mesmoStatus = t.status === status;
    const mesmaPrioridade =
      filtroPrioridade === "todas" || t.prioridade === filtroPrioridade;
    const combinaComBusca =
      termo === "" ||
      t.titulo.toLowerCase().includes(termo) ||
      t.descricao.toLowerCase().includes(termo);

    return mesmoStatus && mesmaPrioridade && combinaComBusca;
  });
}

// UPDATE
async function atualizarTarefa(id: number, mudancas: Partial<DadosTarefa>): Promise<Tarefa> {
  return requisitar<Tarefa>(`/api/tarefas/${id}`, "PUT", mudancas);
}

// DELETE
async function removerTarefa(id: number): Promise<void> {
  await requisitar<void>(`/api/tarefas/${id}`, "DELETE");
}

// Executa uma ação, atualiza a tela e mostra o erro (se houver)
async function executar(acao: () => Promise<void>): Promise<void> {
  try {
    await acao();
    await carregarTarefas();
    renderizar();
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Algo deu errado.";
    mostrarToast(`Não foi possível concluir: ${mensagem}`, false);
  }
}

// ---------- 6. DOM: helpers ----------

// Pega um elemento pelo id e garante que ele existe
function pegar<T extends HTMLElement>(id: string): T {
  const elemento = document.getElementById(id);
  if (!elemento) throw new Error(`Elemento #${id} não encontrado`);
  return elemento as T;
}

// Cria um elemento com classe e texto (textContent evita injeção de HTML)
function criar<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  classe?: string,
  texto?: string
): HTMLElementTagNameMap[K] {
  const elemento = document.createElement(tag);
  if (classe) elemento.className = classe;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

function ehPrioridade(valor: string): valor is Prioridade {
  return valor === "baixa" || valor === "media" || valor === "alta";
}

function ehStatus(valor: string): valor is Status {
  return valor === "pendente" || valor === "em-andamento" || valor === "concluida";
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

// ---------- 7. DOM: renderização ----------

function criarCard(tarefa: Tarefa): HTMLElement {
  const card = criar("article", `card prioridade-${tarefa.prioridade}`);

  const topo = criar("div", "card-topo");
  topo.append(
    criar("span", `selo selo-${tarefa.prioridade}`, ROTULOS_PRIORIDADE[tarefa.prioridade]),
    criar("span", "data", formatarData(tarefa.criadaEm))
  );

  const titulo = criar("h3", "card-titulo", tarefa.titulo);
  card.append(topo, titulo);

  if (tarefa.descricao) {
    card.append(criar("p", "card-descricao", tarefa.descricao));
  }

  const rodape = criar("div", "card-acoes");

  for (const acao of ACOES[tarefa.status]) {
    const botao = criar("button", "btn btn-principal", acao.rotulo);
    botao.type = "button";
    botao.addEventListener("click", () =>
      executar(async () => { await atualizarTarefa(tarefa.id, { status: acao.destino }); })
    );
    rodape.append(botao);
  }

  const editar = criar("button", "btn btn-texto", "Editar");
  editar.type = "button";
  editar.addEventListener("click", () => abrirEdicao(tarefa.id));

  const excluir = criar("button", "btn btn-texto btn-perigo", "Excluir");
  excluir.type = "button";
  excluir.addEventListener("click", () => excluirComDesfazer(tarefa.id));

  rodape.append(editar, excluir);
  card.append(rodape);

  return card;
}

function criarColuna(status: Status): HTMLElement {
  const lista = listarPorStatus(status);

  const coluna = criar("section", `coluna coluna-${status}`);
  coluna.setAttribute("aria-label", ROTULOS_STATUS[status]);

  const cabecalho = criar("header", "coluna-cabecalho");
  cabecalho.append(
    criar("h2", "coluna-titulo", ROTULOS_STATUS[status]),
    criar("span", "coluna-contagem", String(lista.length))
  );
  coluna.append(cabecalho);

  const corpo = criar("div", "coluna-corpo");
  if (lista.length === 0) {
    corpo.append(criar("p", "vazio", MENSAGENS_VAZIO[status]));
  } else {
    // Mais recentes primeiro
    const ordenada = [...lista].sort((a, b) => b.criadaEm.localeCompare(a.criadaEm));
    for (const tarefa of ordenada) {
      corpo.append(criarCard(tarefa));
    }
  }
  coluna.append(corpo);

  return coluna;
}

function renderizar(): void {
  const quadro = pegar<HTMLElement>("quadro");
  quadro.replaceChildren(...COLUNAS.map(criarColuna));

  const total = tarefas.length;
  const concluidas = tarefas.filter((t) => t.status === "concluida").length;
  const resumo = pegar<HTMLElement>("resumo");
  resumo.textContent =
    total === 0
      ? "Nenhuma tarefa cadastrada"
      : `${concluidas} de ${total} ${total === 1 ? "tarefa concluída" : "tarefas concluídas"}`;

  const barra = pegar<HTMLElement>("progresso-barra");
  barra.style.width = total === 0 ? "0%" : `${Math.round((concluidas / total) * 100)}%`;
}

// ---------- 8. DOM: edição e exclusão ----------

function abrirEdicao(id: number): void {
  const tarefa = buscarPorId(id);
  if (!tarefa) return;

  idEmEdicao = id;
  pegar<HTMLInputElement>("edit-titulo").value = tarefa.titulo;
  pegar<HTMLTextAreaElement>("edit-descricao").value = tarefa.descricao;
  pegar<HTMLSelectElement>("edit-prioridade").value = tarefa.prioridade;
  pegar<HTMLSelectElement>("edit-status").value = tarefa.status;

  pegar<HTMLDialogElement>("dialogo-edicao").showModal();
}

async function excluirComDesfazer(id: number): Promise<void> {
  const tarefa = buscarPorId(id);
  if (!tarefa) return;

  await executar(() => removerTarefa(id));
  ultimaExcluida = tarefa;
  mostrarToast(`“${tarefa.titulo}” foi excluída.`, true);
}

// Desfazer = criar a tarefa de novo com os mesmos dados
async function desfazerExclusao(): Promise<void> {
  if (!ultimaExcluida) return;

  const { titulo, descricao, prioridade, status, criadaEm } = ultimaExcluida;
  ultimaExcluida = null;
  esconderToast();
  await executar(async () => {
    await adicionarTarefa({ titulo, descricao, prioridade, status, criadaEm });
  });
}

function mostrarToast(mensagem: string, comDesfazer: boolean): void {
  const toast = pegar<HTMLElement>("toast");
  pegar<HTMLElement>("toast-texto").textContent = mensagem;
  pegar<HTMLButtonElement>("toast-desfazer").hidden = !comDesfazer;
  toast.hidden = false;

  window.clearTimeout(temporizadorToast);
  temporizadorToast = window.setTimeout(esconderToast, 5000);
}

function esconderToast(): void {
  pegar<HTMLElement>("toast").hidden = true;
}

// ---------- 9. EVENTOS ----------

function configurarEventos(): void {
  // Cadastro
  const formNova = pegar<HTMLFormElement>("form-nova");
  formNova.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    const titulo = pegar<HTMLInputElement>("titulo").value;
    const descricao = pegar<HTMLTextAreaElement>("descricao").value;
    const prioridade = pegar<HTMLSelectElement>("prioridade").value;

    if (titulo.trim() === "") {
      pegar<HTMLInputElement>("titulo").focus();
      return;
    }
    if (!ehPrioridade(prioridade)) return;

    await executar(async () => {
      await adicionarTarefa({ titulo, descricao, prioridade });
      formNova.reset();
    });
    pegar<HTMLInputElement>("titulo").focus();
  });

  // Busca e filtro
  pegar<HTMLInputElement>("busca").addEventListener("input", (evento) => {
    termoBusca = (evento.target as HTMLInputElement).value;
    renderizar();
  });

  pegar<HTMLSelectElement>("filtro-prioridade").addEventListener("change", (evento) => {
    const valor = (evento.target as HTMLSelectElement).value;
    filtroPrioridade = valor === "todas" || ehPrioridade(valor) ? valor : "todas";
    renderizar();
  });

  // Edição
  const dialogo = pegar<HTMLDialogElement>("dialogo-edicao");
  pegar<HTMLFormElement>("form-edicao").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    if (idEmEdicao === null) return;

    const titulo = pegar<HTMLInputElement>("edit-titulo").value.trim();
    const prioridade = pegar<HTMLSelectElement>("edit-prioridade").value;
    const status = pegar<HTMLSelectElement>("edit-status").value;
    if (titulo === "" || !ehPrioridade(prioridade) || !ehStatus(status)) return;

    const id = idEmEdicao;
    const descricao = pegar<HTMLTextAreaElement>("edit-descricao").value.trim();

    idEmEdicao = null;
    dialogo.close();
    await executar(async () => {
      await atualizarTarefa(id, { titulo, descricao, prioridade, status });
    });
  });

  pegar<HTMLButtonElement>("edit-cancelar").addEventListener("click", () => {
    idEmEdicao = null;
    dialogo.close();
  });

  // Toast
  pegar<HTMLButtonElement>("toast-desfazer").addEventListener("click", desfazerExclusao);
}

// ---------- 10. INÍCIO ----------

async function iniciar(): Promise<void> {
  configurarEventos();
  try {
    await carregarTarefas();
  } catch {
    mostrarToast("Não foi possível conectar ao servidor. Ele está rodando?", false);
  }
  renderizar();
}

iniciar();

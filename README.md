# Gerenciador de tarefas com banco de dados

TypeScript + Express + SQLite. Os dados ficam no arquivo `tarefas.db`
e continuam lá mesmo depois de fechar o servidor ou o navegador.

## Como rodar

Requisitos: Node.js 20 ou mais novo.

```bash
npm install
npm start
```

Abra http://localhost:3000

Para desenvolver (reinicia o servidor ao salvar arquivos do servidor):

```bash
npm run dev
```

Se mudar o front end (`src/cliente/main.ts`), rode `npm run build` e atualize a página.

## Estrutura

```
src/
  servidor/
    tipos.ts      Union Types e interfaces (Status, Prioridade, Tarefa)
    banco.ts      SQLite: CREATE TABLE e as 4 operações do CRUD em SQL
    servidor.ts   Express: rotas da API e validação
  cliente/
    main.ts       Front end: fetch + async/await + DOM
public/
  index.html
  style.css
  main.js         gerado por "npm run build"
tarefas.db        criado automaticamente na primeira execução
```

## API

| Método | Rota                | O que faz            |
|--------|---------------------|----------------------|
| GET    | /api/tarefas        | Lista todas          |
| POST   | /api/tarefas        | Cria uma tarefa      |
| PUT    | /api/tarefas/:id    | Atualiza campos      |
| DELETE | /api/tarefas/:id    | Exclui uma tarefa    |

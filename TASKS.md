# Epistemap: Quadro de Controle e Tarefas (Kanban)

Este documento é a **Única Fonte da Verdade (Single Source of Truth)** para o desenvolvimento do Epistemap, guiado por *Spec-Driven Development* (SDD). Cada tarefa possui uma especificação prévia e cobertura de testes de aceitação antes de ser considerada concluída.

---

## Colunas do Fluxo

### [x] Concluído
- [x] **Fase 0.1 - Inicialização do Repositório**: Scaffold com Vite, React 19, TypeScript e dependências fundamentais (`@xyflow/react`, `zustand`, `react-markdown`, `katex`, `lucide-react`).
- [x] **Fase 0.2 - Setup do Oráculo de Testes**: Configuração do Vitest e `@testing-library/react` para execução do loop fechado de SDD.
- [x] **Fase 0.3 - Arquitetura e Decisão de Escopo**: Alinhamento via `/grill-me` (modelo híbrido de nós aninhados + drill-down, local-first, descrições em Markdown + LaTeX).
- [x] **Fase 1 - Core de Domínio do Grafo & Invariantes Hierárquicas (SDD)**:
  - Definidos tipos estritos de nós, sub-nós, arestas e breadcrumbs ([types.ts](file:///home/kchima/repos/epistemap/src/core/types.ts)).
  - Suíte de 9 testes de aceitação automatizados com 100% de aprovação ([graphStore.test.ts](file:///home/kchima/repos/epistemap/src/core/__tests__/graphStore.test.ts)).
  - Store reativa desenvolvida com `Zustand` ([graphStore.ts](file:///home/kchima/repos/epistemap/src/core/graphStore.ts)) com remoção em cascata, prevenção de ciclos, navegação por breadcrumbs e filtragem de elementos visíveis.
- [x] **Fase 2 - Canvas Interativo com React Flow & Nós Compostos**:
  - Implementado componente de Nó Customizado ([CompoundNode.tsx](file:///home/kchima/repos/epistemap/src/components/CompoundNode.tsx)) com suporte a sub-objetos aninhados, botão de subdivisão rápida (`+ Sub-objeto`), focar (`Focar`) e contador de sub-conceitos com colapso.
  - Barra de navegação superior com Breadcrumbs dinâmicos ([BreadcrumbsBar.tsx](file:///home/kchima/repos/epistemap/src/components/BreadcrumbsBar.tsx)) para drill-down e retorno.
  - Conexão interativa entre nós (arestas direcionais e handles de entrada/saída).
  - Canvas React Flow integrado ([App.tsx](file:///home/kchima/repos/epistemap/src/App.tsx)) com controles, minimap e grid pontilhado.
- [x] **Fase 3 - Painel Lateral de Detalhes (Inspetor de Conhecimento)**:
  - Painel lateral retrátil ([NodeInspector.tsx](file:///home/kchima/repos/epistemap/src/components/NodeInspector.tsx)) acionado ao selecionar qualquer nó.
  - Edição em tempo real de título, tags, adição de sub-objetos e exclusão de ramo.
  - Abas "Ver" e "Editar" com renderização de Markdown e equações científicas em KaTeX/LaTeX.
- [x] **Fase 4 - Persistência Local-First e Exportação/Importação**:
  - Sincronização contínua com `localStorage` (`epistemap_state_v1`).
  - Botão de exportação para download de arquivo `.json` estruturado.
  - Botão de importação para carregar arquivos `.json` existentes.
- [x] **Fase 5 - Validação Visual e de Regressão**:
  - Validação end-to-end com agente de navegador executando em `http://localhost:5173/`.
  - 100% dos testes unitários passando no Vitest (`npm test`).
  - Build de produção validado sem erros (`npm run build`).

### [/] Em Andamento
- [/] **Fase 6 - Demonstração & Alinhamento de Próximas Iterações com o Usuário**:
  - Apresentar o ambiente em execução, o funcionamento do SDD e coletar feedback para novos recursos.

### [ ] A Fazer (Backlog Priorizado para Próximas Sessões)
- [ ] Suporte a busca e filtro semântico de nós por tags e texto.
- [ ] Layout automático com Dagre ou ElkJS para auto-organizar grafos densos.
- [ ] Exportação do canvas em imagem PNG / SVG em alta resolução.

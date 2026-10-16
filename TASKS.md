# Epistemap: Quadro de Controle e Tarefas (Kanban)

Este documento é a **Única Fonte da Verdade (Single Source of Truth)** para o desenvolvimento do Epistemap, guiado por _Spec-Driven Development_ (SDD). Cada tarefa possui uma especificação prévia e cobertura de testes de aceitação antes de ser considerada concluída.

---

## Colunas do Fluxo

### [x] Concluído

- [x] **Fase 0.1 - Inicialização do Repositório**: Scaffold com Vite, React 19, TypeScript e dependências fundamentais (`@xyflow/react`, `zustand`, `react-markdown`, `katex`, `lucide-react`, `@dagrejs/dagre`).
- [x] **Fase 0.2 - Setup do Oráculo de Testes**: Configuração do Vitest e `@testing-library/react` para execução do loop fechado de SDD.
- [x] **Fase 0.3 - Arquitetura e Decisão de Escopo**: Alinhamento via `/grill-me` (modelo híbrido de nós aninhados + drill-down, local-first, descrições em Markdown + LaTeX).
- [x] **Fase 1 - Core de Domínio do Grafo & Invariantes Hierárquicas (SDD v2)**:
  - Definidos tipos estritos de nós, sub-nós, arestas e breadcrumbs ([types.ts](file:///home/kchima/repos/epistemap/src/core/types.ts)).
  - Funções puras de hierarquia, links e saneamento resiliente ([graph.ts](file:///home/kchima/repos/epistemap/src/core/graph.ts)).
  - Store reativa desacoplada ([graphStore.ts](file:///home/kchima/repos/epistemap/src/core/graphStore.ts)) com remoção em cascata, prevenção estrita de ciclos (`canReparent` / `reparentNode`) e posicionamento sem colisão (`findFreePosition`).
  - 26 testes de aceitação unitários cobrindo o core de domínio ([graph.test.ts](file:///home/kchima/repos/epistemap/src/core/__tests__/graph.test.ts) e [graphStore.test.ts](file:///home/kchima/repos/epistemap/src/core/__tests__/graphStore.test.ts)).
- [x] **Fase 2 - Motor de Layout Espacial e Projeção Visual (v2)**:
  - Resolução do problema de alinhamento em eixo único via cálculo de contêineres bottom-up ([layout.ts](file:///home/kchima/repos/epistemap/src/core/layout.ts)).
  - Contêineres de pais envolvem perfeitamente os sub-nós com padding e gap sem sobreposição.
  - Auto-layout Dagre integrado (`applyDagreLayout`) com botão **"Organizar Mapa"** na barra superior para espalhar grafos no canvas.
  - 8 testes de aceitação do motor de layout ([layout.test.ts](file:///home/kchima/repos/epistemap/src/core/__tests__/layout.test.ts)).
- [x] **Fase 3 - Componentes e Inspetor de Conhecimento**:
  - Nó customizado ([CompoundNode.tsx](file:///home/kchima/repos/epistemap/src/components/CompoundNode.tsx)) adaptativo para folhas e contêineres compostos com indicador numérico e expansão/recolhimento.
  - Inspetor lateral ([NodeInspector.tsx](file:///home/kchima/repos/epistemap/src/components/NodeInspector.tsx)) com seletor de paleta de cores, suporte a fórmulas matemáticas (KaTeX), hiperlinks semânticos (`[[WikiLinks]]`) e lista de referências recíprocas (Backlinks).
  - Correção de input de tags com estado local desacoplado.
  - Barra de navegação superior ([BreadcrumbsBar.tsx](file:///home/kchima/repos/epistemap/src/components/BreadcrumbsBar.tsx)) com drill-down, criação de nós e auto-organização.
- [x] **Fase 4 - Persistência Local-First e Migração**:
  - Persistência em `localStorage` sob a chave `epistemap:v2`.
  - Migração automática e transparente de dados de versões anteriores (`epistemap_state_v1`).
  - Importação e exportação de mapas completos em arquivos `.json`.
- [x] **Fase 5 - Validação Visual e de Regressão Verificada**:
  - 34/34 testes de aceitação aprovados com 100% de sucesso no Vitest (`npm test`).
  - Build de produção verificado sem erros (`npm run build`).
  - Inspeção visual automatizada no navegador (`http://localhost:5173/`), confirmando ausência de sobreposição e correto espalhamento espacial dos nós.

### [/] Em Andamento

- [/] **Fase 6 - Demonstração & Alinhamento de Próximas Iterações com o Usuário**:
  - Coletar feedback sobre a nova distribuição espacial e ferramentas do Epistemap v2.

### [ ] A Fazer (Backlog Priorizado para Próximas Sessões)

- [ ] Suporte a busca global e filtro semântico por tags ou título na barra superior.
- [ ] Exportação do mapa mental como imagem em alta resolução (PNG / SVG).
- [ ] Arrastar um sub-objeto para fora do contêiner para promovê-lo a conceito raiz (drag-and-drop reparenting).

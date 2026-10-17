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
- [x] **Fase 2 - Motor de Layout Espacial e Projeção Visual (v2)**:
  - Resolução do problema de alinhamento em eixo único via cálculo de contêineres bottom-up ([layout.ts](file:///home/kchima/repos/epistemap/src/core/layout.ts)).
  - Contêineres de pais envolvem perfeitamente os sub-nós com padding e gap sem sobreposição.
  - Auto-layout Dagre integrado (`applyDagreLayout`) com botão **"Organizar Mapa"** na barra superior para espalhar grafos no canvas.
- [x] **Fase 3 - Componentes e Inspetor de Conhecimento**:
  - Nó customizado ([CompoundNode.tsx](file:///home/kchima/repos/epistemap/src/components/CompoundNode.tsx)) adaptativo para folhas e contêineres compostos com indicador numérico e expansão/recolhimento.
  - Inspetor lateral ([NodeInspector.tsx](file:///home/kchima/repos/epistemap/src/components/NodeInspector.tsx)) com seletor de paleta de cores, suporte a fórmulas matemáticas (KaTeX), hiperlinks semânticos (`[[WikiLinks]]`) e lista de referências recíprocas (Backlinks).
  - Barra de navegação superior ([BreadcrumbsBar.tsx](file:///home/kchima/repos/epistemap/src/components/BreadcrumbsBar.tsx)) com drill-down, criação de nós e auto-organização.
- [x] **Fase 4 - Persistência Local-First e Migração**:
  - Persistência em `localStorage` sob a chave `epistemap:v2` (incluindo preservação de estado vazio após exclusão total).
  - Migração automática e transparente de dados de versões anteriores (`epistemap_state_v1`).
  - Importação e exportação de mapas completos em arquivos `.json`.
- [x] **Fase 5 - Validação Visual e de Regressão Verificada**:
  - Suíte de testes de aceitação unitários e de componentes aprovada no Vitest (`npm test`).
  - Build de produção verificado sem erros (`npm run build`).
- [x] **Fase 6 - Evolução Completa v2.1 (Pacotes A, B, C e D)**:
  - **Histórico Temporal (Undo/Redo)**: Integração do middleware `zundo` em [graphStore.ts](file:///home/kchima/repos/epistemap/src/core/graphStore.ts) com atalhos `Cmd+Z` / `Cmd+Shift+Z` e botões na barra superior.
  - **Drag-and-Drop Reparenting & Seletor de Pai**: Detecção espacial de colisão (`isNodeInsideBoundingBox`, `findDropTargetNodeId`) com highlight de borda no alvo, promoção de sub-objeto a conceito raiz ao arrastar para o vazio e seletor alternativo de pai no [NodeInspector.tsx](file:///home/kchima/repos/epistemap/src/components/NodeInspector.tsx).
  - **Busca Global Inteligente (`Cmd+K`)**: Modal [CommandPalette.tsx](file:///home/kchima/repos/epistemap/src/components/CommandPalette.tsx) com busca por título, tags e conteúdo, expansão automática de ancestrais colapsados (`navigateToNode`) e filtro rápido de tags na barra superior.
  - **Red Links (`[[Novo Conceito]]`)**: Criação instantânea com 1 clique de conceitos inexistentes referenciados no Markdown (`createNodeFromWikiLink`), adicionando aresta e abrindo no Inspetor.
  - **Gestão Interativa de Arestas**: Seleção de arestas no canvas, edição de rótulo (`updateEdgeLabel`) e exclusão no Inspetor ou via teclado.
  - **Exportação PNG 2x Retina**: Captura do grafo completo em alta resolução via `html-to-image` e `getViewportForBounds` em [BreadcrumbsBar.tsx](file:///home/kchima/repos/epistemap/src/components/BreadcrumbsBar.tsx).
  - **Higienização & Code-Splitting**: Zero warnings no Oxlint (`npm run lint`), remoção de assets mortos do template Vite e divisão de chunks (`katex`, `reactflow`, `markdown`, `vendor`) abaixo de 300 kB em [vite.config.ts](file:///home/kchima/repos/epistemap/vite.config.ts).
- [x] **Fase 7 - Integração Desktop Nativa & Resiliência de Execução**:
  - **Launcher & Ciclo de Vida da Janela**: Script [epistemap-launcher.sh](file:///home/kchima/repos/epistemap/bin/epistemap-launcher.sh) e link `~/.local/bin/epistemap` com monitoramento em foreground e encerramento determinístico via trap (`stop_server`) de modo que fechar a janela ou matar o processo elimina imediatamente qualquer processo órfão do Node/Vite e libera a porta 5173.
  - **Resolução da Tela Preta no Wayland & Carregamento Offline**: Configuração de flags Ozone (`--enable-features=UseOzonePlatform --ozone-platform=wayland`) e desativação de Vulkan (`--disable-vulkan-surface --disable-features=Vulkan`) em perfil isolado (`--user-data-dir`). Eliminação do `@import` bloqueante de fontes externas no CSS, garantindo renderização inicial (FCP) instantânea no `#0d1017` mesmo offline.
  - **Prevenção de Aborto por Concorrência (Multi-instância)**: Detecção de instâncias pré-existentes (`is_server_running` + `pgrep chrome-profile`); se o usuário invocar o launcher com a janela já aberta, a janela é focada e o script sai sem disparar o encerramento do servidor em background.
  - **Vinculação de Ciclo de Vida no Kernel (PR_SET_PDEATHSIG)**: O servidor Node é disparado com sinal de morte ao processo pai via kernel Linux (`PR_SET_PDEATHSIG=SIGTERM`), garantindo que se o launcher for morto com `SIGKILL` (`kill -9`) ou terminal fechado, o Node encerra sem órfãos.
  - **Auto-rebuild Otimizado**: O launcher detecta alterações em `src/`, `public/`, `index.html`, `vite.config.ts` ou `package.json` e recompila o bundle de produção automaticamente com `--strictPort` antes de subir o servidor preview.
  - **ErrorBoundary com Recuperação**: Componente [ErrorBoundary.tsx](file:///home/kchima/repos/epistemap/src/components/ErrorBoundary.tsx) com cobertura de testes unitários para interceptar exceções de renderização e oferecer ações de recarregamento e restauração de dados limpos.

- [x] **Fase 8 - Temas Visuais, Handles Dinâmicos, TeX & PDF (v2.2)**:
  - **Ergonomia dos Handles de Conexão**: Handles invisíveis por padrão, visíveis apenas no nó selecionado e destacados em todos os nós compatíveis durante conexão com efeito de escala suave ao aproximar o cursor.
  - **Sistema de 3 Temas**: Escuro, Claro e Alto Contraste Papel/Impresso (`2px solid #000`, fundo `#fff`, texto `#000`), com seletor na barra superior e persistência em `localStorage`.
  - **Importador de Compêndios LaTeX (.tex)**: Parser em [texImporter.ts](file:///home/kchima/repos/epistemap/src/core/texImporter.ts) convertendo seções, teoremas, lemas e definições em nós conceituais com equações KaTeX preservadas e layout Dagre automático.
  - **Acoplamento de PDFs com Leitor Integrado**: Upload em Base64 no próprio JSON do nó e leitor embutido [PdfViewerPanel.tsx](file:///home/kchima/repos/epistemap/src/components/PdfViewerPanel.tsx) no Inspetor com controles de página e salto externo para o Zathura.
- [x] **Fase 9 - Menu de Configurações, Gestão de Backups & Preparação Open-Source (v2.3)**:
  - **Menu de Configurações**: Componente [SettingsModal.tsx](file:///home/kchima/repos/epistemap/src/components/SettingsModal.tsx) acionado pela barra superior e atalho `Cmd+,` / `Ctrl+,`.
  - **Motor de Backups Eficientes**: Módulo [backup.ts](file:///home/kchima/repos/epistemap/src/core/backup.ts) com exportação completa e exportação leve (< 50 KB, ideal para sincronizar com o repositório git `ygg`).
  - **Snapshots Locais**: Criação, listagem e restauração de pontos de restauração históricos no navegador.
  - **Documentação & Open Source**: [README.md](file:///home/kchima/repos/epistemap/README.md) completo com instruções de instalação, badges, guia do lançador desktop Rofi, atalhos e licença [LICENSE](file:///home/kchima/repos/epistemap/LICENSE) MIT.
  - **Proteção de Privacidade**: [.gitignore](file:///home/kchima/repos/epistemap/.gitignore) estrito bloqueando arquivos de backup, PDFs e logs para manter o repositório 100% neutro.

- [x] **Fase 10 - Zoom Semântico por Nível de Detalhe (Level of Detail - LoD)**:
  - Transições discretas e livres de layout shifts baseadas na escala de zoom da câmera (`macro` < 0.65, `standard` 0.65–1.30, `micro` >= 1.30) via seletor Zustand do React Flow em [lod.ts](file:///home/kchima/repos/epistemap/src/core/lod.ts).
  - Nível `macro`: visual minimalista panorâmico sem poluição de textos de 2px, destacando títulos e contadores numéricos.
  - Nível `standard`: visual balanceado com tags, botões de ação e resumo em texto.
  - Nível `micro`: renderização rica de fórmulas matemáticas KaTeX em nós folha e revelação de lista interna interativa de seções e definições em contêineres recolhidos ([CompoundNode.tsx](file:///home/kchima/repos/epistemap/src/components/CompoundNode.tsx)).
  - Expansão da amplitude de zoom no React Flow (`minZoom: 0.15`, `maxZoom: 4.0`).
  - Cobertura com 15 novos testes unitários e de integração ([lod.test.ts](file:///home/kchima/repos/epistemap/src/core/__tests__/lod.test.ts) e [CompoundNode.test.tsx](file:///home/kchima/repos/epistemap/src/components/__tests__/CompoundNode.test.tsx)).

### [/] Em Andamento

- [x] **Fase 11 - Trilha de Conhecimento Horizontal (Layout LR & Fluxo Didático)**:
  - Organização padrão estrita da esquerda para a direita (LR) para todas as ligações e nós do grafo.
  - Sub-nós (axiomas, definições, teoremas e corolários) dispostos lado a lado horizontalmente dentro dos contêineres, ordenados topologicamente com axiomas e precedentes no extremo esquerdo ([`orderChildrenHorizontal`](file:///home/kchima/repos/epistemap/src/core/layout.ts#L40-L100)).
  - O conteúdo textual e fórmulas matemáticas expandem verticalmente para baixo dentro de cada cartão ([`calculateLeafHeight`](file:///home/kchima/repos/epistemap/src/core/layout.ts#L18-L38)).
  - Handles de conexão restritos à entrada esquerda (`Position.Left`) e saída direita (`Position.Right`) em [CompoundNode.tsx](file:///home/kchima/repos/epistemap/src/components/CompoundNode.tsx) para fluxo contínuo em esteira de conhecimento.
  - Distribuição horizontal de raízes desconexas no Dagre (`applyDagreLayout`).
  - Cobertura com 157 testes automatizados aprovados no Vitest.
- [x] **Fase 12 - Atalho Rofi & Lançador Desktop para Desenvolvimento (HMR)**:
  - Entrada de desktop dedicada `epistemap-dev.desktop` instalada em `~/.local/share/applications/` com nome `EpisteMap (Dev)`.
  - Execução via `epistemap dev` acionando servidor Vite em tempo real com Hot Module Reloading (HMR).
  - Ciclo de vida estrito com encerramento do servidor Node e liberação de porta ao fechar a janela do Chrome.
  - Subcomandos `install` e `uninstall` atualizados em [epistemap-launcher.sh](file:///home/kchima/repos/epistemap/bin/epistemap-launcher.sh) para sincronizar ambos os lançadores desktop e o link simbólico `~/.local/bin/epistemap`.
- [x] **Fase 13 - Modo Estendido Padrão, Altura Dobrada & Sub-objetos Focados em Título**:
  - Modo estendido com todos os sub-objetos visíveis lado a lado estabelecido como padrão invariante para qualquer distância de zoom (`layout.ts` e `lod.ts`).
  - Altura base dos cartões de objetos dobrada de 112px para 224px (`LEAF_HEIGHT = 224`), gerando contêineres proporcionais e espaçosos de 300px.
  - Sub-objetos no nível de zoom padrão exibem exclusivamente seus títulos e identificadores, omitindo conteúdos e descrições textuais ruidosas ([CompoundNode.tsx](file:///home/kchima/repos/epistemap/src/components/CompoundNode.tsx)).
  - Conteúdos ricos e fórmulas KaTeX revelados ao aproximar com zoom in (nível micro >= 1.30) ou via Inspetor lateral.
- [x] **Fase 14 - Inspetor de Conhecimento Recolhível & Dock Rail Acessível**:
  - Painel lateral do Inspetor (`NodeInspector.tsx`) recolhível para liberar espaço do canvas do React Flow.
  - No estado recolhido, recolhe para um dock rail elegante de 36px na margem direita com título vertical, indicador de cor do nó selecionado e botão de expansão (`ChevronLeft`).
  - No estado expandido, inclui botão explícito de recolhimento (`PanelRightClose`) em todas as visualizações do cabeçalho (vazio, nó selecionado e aresta selecionada).
  - Botão de alternância "Inspetor" com ícone dinâmico integrado na barra superior (`BreadcrumbsBar.tsx`).
  - Atalho global de teclado `Cmd+\` / `Ctrl+\` registrado no canvas (`App.tsx`) e catalogado no modal de atalhos (`SettingsModal.tsx`).
  - Preferência do usuário persistida localmente em `localStorage('epistemap:inspector-open')`.
- [x] **Fase 15 - Modo de Edição e Modo de Visualização (Canvas e Leitura Limpos)**:
  - Estado `editorMode: 'edit' | 'view'` adicionado à store Zustand com persistência local em `localStorage('epistemap:editor-mode')` (padrão `'edit'`).
  - Alternador segmentado `[ Edição | Visualização ]` na barra superior (`BreadcrumbsBar.tsx`) com ícones táteis (`Pencil` e `Eye`).
  - No **Modo de Visualização (`view`)**:
    - **Canvas**: Handles de conexão dos nós ocultados com `display: none !important; opacity: 0; pointer-events: none;`, botões `+ Sub` e `+ Sub-objeto` ocultados, arrasto de nós (`nodesDraggable={false}`) e novas conexões (`nodesConnectable={false}`) desativados, duplo clique no canvas desativado e indicador de drop target suprimido.
    - **Barra Superior**: Controles de mutação ocultos (`Novo Conceito`, `Organizar Mapa`, `Desfazer / Refazer`) e seção de importação ocultada no menu `Arquivo` (mantendo opções de exportação PNG 2x e JSON).
    - **Inspetor Lateral**: Ocultados inputs mutáveis (input de título, seletor de nó pai, paleta de cores, input de tags, aba/área de edição Markdown, dropzone de anexo PDF e botões de exclusão de nó/aresta). Título exibido em tipografia heading `h2`, tags como badges estáticas `#tag`, nó pai como link de navegação, preview Markdown e KaTeX renderizado diretamente, leitor PDF limpo, e WikiLinks não mapeados como texto elegante inerte `[[Nome]]`.
    - **Atalhos de Teclado**: `Cmd+E` / `Ctrl+E` alterna instantaneamente entre modos. No modo visualização, atalhos de mutação (`Tab`, `Enter`, `Delete`, `Backspace`, `Cmd+Z`, `Cmd+Y`) são desativados. Atalho documentado em `SettingsModal.tsx`.
  - Suíte de 160 testes aprovada no Vitest (14 arquivos) e 0 erros no Oxlint.
- [x] **Fase 16 - Remoção do Indicador de Página nos Objetos do Mapa**:
  - Removido o badge de página (`p.X` / clipe) dos cartões de nós no canvas ([CompoundNode.tsx](file:///home/kchima/repos/epistemap/src/components/CompoundNode.tsx)), garantindo que a tipografia do título permaneça limpa, espaçosa e sem ruído visual no grafo.
  - Informações de anexo, número de página de referência e leitor embutido mantidos de forma rica e organizada no painel do Inspetor ([NodeInspector.tsx](file:///home/kchima/repos/epistemap/src/components/NodeInspector.tsx)).
  - Teste de regressão adicionado em [CompoundNode.test.tsx](file:///home/kchima/repos/epistemap/src/components/__tests__/CompoundNode.test.tsx) (161 testes aprovados no total).
- [x] **Fase 17 - Remoção das Tags Escritas nos Cartões do Mapa**:
  - Removida a renderização de tags textuais (`#tag`) do rodapé dos cartões de nós no canvas ([CompoundNode.tsx](file:///home/kchima/repos/epistemap/src/components/CompoundNode.tsx)), preservando a estética minimalista e focada exclusivamente no título e na hierarquia visual do grafo.
  - O botão de ação rápida `+ Sub` foi posicionado de forma limpa à direita no rodapé (no modo de edição).
  - Gerenciamento completo, edição e filtragem de tags preservados no Inspetor de Conhecimento ([NodeInspector.tsx](file:///home/kchima/repos/epistemap/src/components/NodeInspector.tsx)), na busca global (`Cmd+K`) e no filtro da barra superior ([BreadcrumbsBar.tsx](file:///home/kchima/repos/epistemap/src/components/BreadcrumbsBar.tsx)).
  - Testes em [CompoundNode.test.tsx](file:///home/kchima/repos/epistemap/src/components/__tests__/CompoundNode.test.tsx) atualizados (161 testes aprovados, 0 erros no Oxlint).

### [/] Em Andamento

- _(Nenhuma tarefa pendente no momento)_

### [ ] A Fazer (Backlog Futuro)

#### Exportação & Interoperabilidade Acadêmica / LaTeX
- [ ] **Exportação TikZ / PGFPlots para LaTeX**: Geração de código `\begin{tikzpicture}` estruturado a partir da geometria e arestas do grafo para inclusão direta em compêndios, artigos e teses.
- [ ] **Exportação Vetorial Nativa (`.svg`)**: Exportação vetorial nítida em qualquer escala com tipografia preservada e renderização KaTeX vetorizada.
- [ ] **Exportador Bidirecional para `.tex`**: Exportar o grafo de volta como documento `.tex` com seções, subseções e ambientes matemáticos (`definicao`, `teorema`, `corolario`) seguindo a ordem topológica da trilha.
- [ ] **Live Sync com Compêndio LaTeX via SyncTeX**: Sincronização automática em segundo plano (`epistemap dev`) ao recompilar documentos LaTeX com `latexmk`.

#### Modelagem Matemática & Grafo de Conhecimento (DAG)
- [ ] **Trilha de Pré-requisitos & Caminho Crítico (DAG Highlighting)**: Realce com brilho (*glow*) de todos os axiomas, definições e lemas precursores necessários para demonstrar um teorema selecionado, esmaecendo nós não relacionados.
- [ ] **Tipagem Semântica Formal de Arestas**: Estilos geométricos específicos para relações formais ($\implies$ dedução, $\iff$ equivalência, generalização/herança e dependência fraca).
- [ ] **Detector de Ciclos em Pré-requisitos**: Validação em tempo real para impedir dependências circulares em cadeias de pré-requisitos lógicos.

#### Ergonomia de Estudo, Navegação & Canvas
- [ ] **Modo Apresentação / Trilha Guiada (Tour Mode)**: Percorrer conceitos em sequência ordenada ($1 \to 2 \to 3$) com setas do teclado (`←` e `→`) e animação suave de câmera.
- [ ] **Minimapa Flutuante Translúcido (Overview Radar)**: Radar recolhível no canto inferior para navegação ágil em mapas extensos.
- [ ] **Filtro de Destaque no Canvas por Tag / Tipo**: Nós fora do filtro ativo recebem opacidade reduzida (15%), isolando visualmente subconjuntos de conceitos (ex: apenas `#teorema`).
- [ ] **Guias Magnéticas de Alinhamento (Smart Guides / Snap)**: Alinhamento automático e guias inteligentes durante o arrasto manual de conceitos raiz.

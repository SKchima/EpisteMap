# Especificação de Contrato: Epistemap (v2)

Esta especificação substitui a v1. Ela separa o **modelo de domínio** (o que é persistido) da **projeção visual** (o que o React Flow renderiza), porque misturar as duas camadas foi a causa raiz dos bugs da v1.

---

## 0. Diagnóstico da v1

| Problema                                                                      | Causa raiz                                                                               |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Sub-objetos empilhados numa coluna, sobrepostos ao pai                        | Posição fixa `(30 \| 190, 60 + 90k)` e contêiner sem largura/altura derivada dos filhos  |
| Novos conceitos raiz nascem todos no mesmo ponto                              | Posição `(250 + rand·80, 150 + rand·80)`                                                 |
| Drill-down num sub-objeto quebra a renderização                               | O nó focado mantém `parentId` apontando para um pai que não está na lista renderizada    |
| Tecla Backspace deixa filhos órfãos                                           | `applyNodeChanges` remove só o nó, sem cascata                                           |
| Impossível digitar uma segunda tag                                            | Input controlado re-serializa `tags.join(', ')` a cada tecla e engole a vírgula          |
| Excluir todos os nós e recarregar ressuscita o mapa antigo                    | Persistência ignorava `nodes.length === 0`                                               |
| Arestas sem ponta de seta; todas animadas                                     | Sem `markerEnd`; `animated: true` fixo no `onConnect`                                    |
| Links entre nós (escolhidos no alinhamento) inexistentes                      | Não implementado                                                                         |
| Lógica de breadcrumbs e visibilidade duplicada em store e componentes         | Os testes cobriam uma cópia que a UI não usava                                           |
| Campos transitórios do React Flow (`measured`, `selected`) persistidos        | O estado do React Flow era o próprio estado de domínio                                   |

---

## 1. Modelo de Domínio (persistido)

```typescript
type KnowledgeNode = {
  id: string;
  parentId: string | null; // null = conceito raiz
  position: { x: number; y: number }; // só tem significado para raízes
  data: {
    title: string;
    description: string; // Markdown + KaTeX + [[links]]
    tags: string[];
    color: string | null; // herdada pelos descendentes quando null
    collapsed: boolean;
  };
};

type KnowledgeEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
};
```

A ordem dos filhos de um nó é a ordem relativa deles no array `nodes`.

### Invariantes de domínio

1. **I1 (unicidade):** ids de nós e de arestas são únicos.
2. **I2 (integridade referencial):** `parentId` é `null` ou referencia um nó existente.
3. **I3 (aciclicidade):** nenhum nó é ancestral de si mesmo.
4. **I4 (arestas válidas):** extremidades existem; sem laços (`source ≠ target`); no máximo uma aresta por par ordenado `(source, target)`.
5. **I5 (remoção em cascata):** remover `X` remove `X`, todos os descendentes e todas as arestas incidentes a qualquer um deles.
6. **I6 (foco válido):** `focusId` é `null` ou um nó existente. Se o nó em foco for removido, o foco recua para o pai do nó removido (ou `null`).
7. **I7 (seleção válida):** a seleção aponta para um nó ou aresta existente, ou é `null`.
8. **I8 (reparent seguro):** `reparent(X, P)` é rejeitado (retorna `false`, estado inalterado) se `P = X` ou `P` é descendente de `X`.

---

## 2. Projeção Visual (derivada, nunca persistida)

`buildFlow(nodes, edges, { focusId, selection })` é uma função **pura** que produz os nós e arestas do React Flow.

### Layout de contêineres (bottom-up, determinístico)

Constantes: folha `232 × 112`, cabeçalho `48`, padding `16`, gap `16`.

- Nó sem filhos ou recolhido: tamanho de folha.
- Contêiner expandido com `k` filhos: grade com `⌈√k⌉` colunas; cada linha tem a altura do maior filho; largura e altura do contêiner são as menores que envolvem os filhos com padding.

### Invariantes de layout

1. **L1:** folhas e nós recolhidos têm exatamente o tamanho de folha.
2. **L2:** todo filho está contido no retângulo do pai, respeitando padding e cabeçalho.
3. **L3:** irmãos nunca se sobrepõem.
4. **L4:** filhos de nó recolhido não são emitidos.
5. **L5:** todo pai é emitido antes dos seus filhos (exigência do React Flow).
6. **L6:** em foco, só a subárvore do nó focado é emitida; o nó focado não tem `parentId` e fica em `(0, 0)`.
7. **L7:** uma aresta cuja extremidade está oculta (ancestral recolhido) é redirecionada para o ancestral visível mais próximo, tracejada; se as duas extremidades caírem no mesmo nó visível, ela é omitida; arestas para fora da subárvore em foco são omitidas.

### Posicionamento de raízes

- **Novo conceito:** nasce no centro da viewport e é deslocado para a posição livre mais próxima (`findFreePosition`), sem sobreposição.
- **Organizar mapa:** dagre (`rankdir = LR`) sobre as raízes, usando seus tamanhos reais e as arestas elevadas às raízes.

---

## 3. Interação

| Gesto                                   | Efeito                                                                     |
| --------------------------------------- | -------------------------------------------------------------------------- |
| Arrastar um nó e soltar sobre outro     | Torna-se sub-objeto do alvo (respeitando I8); o alvo fica destacado        |
| Arrastar um sub-objeto para o vazio     | Vira conceito raiz na posição solta                                        |
| Duplo clique no vazio                   | Cria conceito raiz ali                                                     |
| Duplo clique num nó com filhos          | Drill-down                                                                 |
| `Tab` / `Enter` com nó selecionado      | Cria sub-objeto / irmão                                                    |
| `Esc`                                   | Limpa a seleção; sem seleção, sobe um nível no drill-down                  |
| `Delete` / `Backspace`                  | Remove com cascata; pede confirmação se houver descendentes                |
| `[[Título]]` na descrição               | Link clicável para o nó; o inspetor lista os nós que referenciam o atual   |

---

## 4. Importação e Persistência

- `sanitizeGraph(input)` aceita qualquer JSON e devolve um grafo que satisfaz I1–I4: preenche campos ausentes, converte o formato v1 (`data.isExpanded`, campos do React Flow), desfaz ciclos e referências quebradas promovendo o nó a raiz, e descarta arestas inválidas. Rejeita entradas sem um array `nodes`.
- Persistência via `zustand/persist` em `epistemap:v2`, gravando só `nodes` e `edges`. Na primeira execução, migra `epistemap_state_v1` se existir; caso contrário, carrega o mapa de exemplo.

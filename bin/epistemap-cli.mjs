#!/usr/bin/env node
/**
 * EpisteMap CLI - Utilitário de linha de comando para automação, IA e manipulação de notas locais.
 * Permite que agentes (como Antigravity) e scripts consultem e editem o vault diretamente.
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

function getVaultPath() {
  if (process.env.EPISTEMAP_VAULT_PATH) return process.env.EPISTEMAP_VAULT_PATH
  const vaultDir = process.env.EPISTEMAP_VAULT_DIR || path.join(os.homedir(), 'notes', 'epistemap')
  return path.join(vaultDir, 'vault.json')
}

function loadVault() {
  const file = getVaultPath()
  if (!fs.existsSync(file)) {
    return {
      version: '2.0',
      updatedAt: new Date().toISOString(),
      nodes: [],
      edges: [],
    }
  }
  try {
    const raw = fs.readFileSync(file, 'utf-8')
    const parsed = JSON.parse(raw)
    const graph = parsed.graph || parsed
    return {
      version: '2.0',
      updatedAt: new Date().toISOString(),
      nodes: Array.isArray(graph.nodes) ? graph.nodes : [],
      edges: Array.isArray(graph.edges) ? graph.edges : [],
    }
  } catch (err) {
    console.error(`Erro ao ler o arquivo do vault em ${file}:`, err)
    process.exit(1)
  }
}

function saveVault(data) {
  const file = getVaultPath()
  const dir = path.dirname(file)
  fs.mkdirSync(dir, { recursive: true })
  data.updatedAt = new Date().toISOString()
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
  console.log(`Vault salvo com sucesso em: ${file}`)
}

function generateId() {
  return 'node_' + Math.random().toString(36).substring(2, 9)
}

function generateEdgeId() {
  return 'edge_' + Math.random().toString(36).substring(2, 9)
}

function parseArgs(args) {
  const flags = {}
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const next = args[i + 1]
      if (next && !next.startsWith('--')) {
        flags[key] = next
        i++
      } else {
        flags[key] = true
      }
    }
  }
  return flags
}

const [command, ...args] = process.argv.slice(2)

switch (command) {
  case 'status': {
    const vault = loadVault()
    const file = getVaultPath()
    console.log(`EpisteMap Vault Status:`)
    console.log(`  Arquivo: ${file}`)
    console.log(`  Nós: ${vault.nodes.length}`)
    console.log(`  Arestas: ${vault.edges.length}`)
    console.log(`  Última atualização: ${vault.updatedAt || 'N/A'}`)
    break
  }

  case 'list': {
    const vault = loadVault()
    console.log(`\n=== Conceitos no EpisteMap Vault (${vault.nodes.length} nós) ===\n`)
    const roots = vault.nodes.filter((n) => !n.parentId)
    const byParent = new Map()
    for (const n of vault.nodes) {
      if (n.parentId) {
        if (!byParent.has(n.parentId)) byParent.set(n.parentId, [])
        byParent.get(n.parentId).push(n)
      }
    }

    function printTree(node, indent = 0) {
      const pad = '  '.repeat(indent)
      const tags = node.data?.tags?.length ? ` [${node.data.tags.join(', ')}]` : ''
      console.log(`${pad}• ${node.data?.title || 'Sem título'} (id: ${node.id})${tags}`)
      const children = byParent.get(node.id) || []
      for (const child of children) {
        printTree(child, indent + 1)
      }
    }

    for (const root of roots) {
      printTree(root, 0)
    }

    if (vault.edges.length > 0) {
      console.log(`\n=== Conexões Semânticas (${vault.edges.length} arestas) ===\n`)
      const nodeMap = new Map(vault.nodes.map((n) => [n.id, n.data?.title || n.id]))
      for (const e of vault.edges) {
        const src = nodeMap.get(e.source) || e.source
        const tgt = nodeMap.get(e.target) || e.target
        const lbl = e.label ? ` --[${e.label}]--> ` : ' ----> '
        console.log(`  ${src}${lbl}${tgt}`)
      }
    }
    console.log('')
    break
  }

  case 'add': {
    const flags = parseArgs(args)
    const title = flags.title || 'Novo Conceito'
    const desc = flags.desc || flags.description || ''
    const tags = flags.tags ? flags.tags.split(',').map((t) => t.trim()) : []
    const color = flags.color || null

    const vault = loadVault()
    let parentId = null

    if (flags.parent) {
      const parentNode = vault.nodes.find(
        (n) => n.id === flags.parent || n.data?.title?.toLowerCase() === flags.parent.toLowerCase()
      )
      if (parentNode) {
        parentId = parentNode.id
      } else {
        console.warn(`Aviso: Nó pai "${flags.parent}" não encontrado. Criando como conceito raiz.`)
      }
    }

    const newNodeId = generateId()
    const newNode = {
      id: newNodeId,
      parentId,
      position: { x: 50 + Math.random() * 200, y: 50 + Math.random() * 200 },
      data: {
        title,
        description: desc,
        tags,
        color,
        collapsed: false,
      },
    }

    vault.nodes.push(newNode)
    saveVault(vault)
    console.log(`Conceito "${title}" adicionado com sucesso (id: ${newNodeId}).`)
    break
  }

  case 'connect': {
    const flags = parseArgs(args)
    if (!flags.source || !flags.target) {
      console.error('Uso: epistemap-cli connect --source "<nome ou id>" --target "<nome ou id>" [--label "relação"]')
      process.exit(1)
    }

    const vault = loadVault()
    const srcNode = vault.nodes.find(
      (n) => n.id === flags.source || n.data?.title?.toLowerCase() === flags.source.toLowerCase()
    )
    const tgtNode = vault.nodes.find(
      (n) => n.id === flags.target || n.data?.title?.toLowerCase() === flags.target.toLowerCase()
    )

    if (!srcNode || !tgtNode) {
      console.error(`Erro: Não foi possível localizar ambos os nós (${flags.source} -> ${flags.target}).`)
      process.exit(1)
    }

    const edgeId = generateEdgeId()
    vault.edges.push({
      id: edgeId,
      source: srcNode.id,
      target: tgtNode.id,
      label: flags.label || '',
    })

    saveVault(vault)
    console.log(`Aresta criada: "${srcNode.data.title}" -> "${tgtNode.data.title}" (id: ${edgeId}).`)
    break
  }

  case 'get': {
    const flags = parseArgs(args)
    const query = flags.title || flags.id || args[0]
    if (!query) {
      console.error('Uso: epistemap-cli get --title "<título>" ou --id "<id>"')
      process.exit(1)
    }
    const vault = loadVault()
    const node = vault.nodes.find(
      (n) => n.id === query || n.data?.title?.toLowerCase() === query.toLowerCase()
    )
    if (!node) {
      console.error(`Nó "${query}" não encontrado.`)
      process.exit(1)
    }
    console.log(JSON.stringify(node, null, 2))
    break
  }

  default:
    console.log(`
EpisteMap CLI - Gestão e Automação de Vault

Comandos disponíveis:
  status                                            Exibe status e caminho do vault ativo
  list                                              Lista a árvore de conceitos e arestas
  add --title "<nome>" [--parent "<pai>"] [--desc "<md>"] [--tags "t1,t2"]  Adiciona novo nó
  connect --source "<origem>" --target "<destino>" [--label "<rotulo>"]     Cria uma conexão
  get --title "<nome>" / --id "<id>"                Retorna os detalhes de um nó em JSON

Variáveis de ambiente suportadas:
  EPISTEMAP_VAULT_PATH   Caminho exato para o vault.json
  EPISTEMAP_VAULT_DIR    Diretório base do vault (padrão: ~/notes/epistemap)
`)
    break
}

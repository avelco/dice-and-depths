import skillTreeData from '../../data/skillTree.json'
import { passiveDef } from './Passives'
import type { MetaSave } from './MetaProgression'

export interface SkillTreeNodeDef {
  id: string
  passiveId: string
  cost: number
  requires: string[]
  col: number
  row: number
}

const NODES: SkillTreeNodeDef[] = (
  skillTreeData as { nodes: SkillTreeNodeDef[] }
).nodes

export function skillTreeNodes(): SkillTreeNodeDef[] {
  return NODES
}

export function skillTreeNode(id: string): SkillTreeNodeDef | undefined {
  return NODES.find(n => n.id === id)
}

export function isNodeUnlocked(meta: MetaSave, nodeId: string): boolean {
  return meta.unlockedTreeNodes.includes(nodeId)
}

export function canUnlock(meta: MetaSave, nodeId: string): boolean {
  const node = skillTreeNode(nodeId)
  if (!node) return false
  if (!passiveDef(node.passiveId)) return false
  if (meta.unlockedTreeNodes.includes(nodeId)) return false
  if (meta.skillPoints < node.cost) return false
  return node.requires.every(req => meta.unlockedTreeNodes.includes(req))
}

/** Passive ids granted by purchased tree nodes (unique). */
export function unlockedPassiveIds(meta: MetaSave): string[] {
  const ids = new Set<string>()
  for (const nodeId of meta.unlockedTreeNodes) {
    const node = skillTreeNode(nodeId)
    if (node) ids.add(node.passiveId)
  }
  return [...ids]
}

import { useState, useCallback, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import * as XLSX from 'xlsx'
import { SourceFieldNode, TargetFieldNode } from './FieldNode'
import styles from './MappingCanvas.module.css'

const NODE_TYPES = {
  sourceField: SourceFieldNode,
  targetField: TargetFieldNode,
}

const NODE_HEIGHT = 52
const NODE_GAP = 12
const SOURCE_X = 60
const TARGET_X = 500

function buildNodes(sourceFields, targetFields) {
  const sourceNodes = sourceFields.map((label, i) => ({
    id: `src-${i}`,
    type: 'sourceField',
    position: { x: SOURCE_X, y: i * (NODE_HEIGHT + NODE_GAP) + 20 },
    data: { label, connected: false },
    draggable: false,
  }))

  const targetNodes = targetFields.map((label, i) => ({
    id: `tgt-${i}`,
    type: 'targetField',
    position: { x: TARGET_X, y: i * (NODE_HEIGHT + NODE_GAP) + 20 },
    data: { label, connected: false },
    draggable: false,
  }))

  return [...sourceNodes, ...targetNodes]
}

export default function MappingCanvas({ sourceFields, targetFields, sourceRows = [], onBack }) {
  const initialNodes = useMemo(
    () => buildNodes(sourceFields, targetFields),
    [sourceFields, targetFields]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  const onConnect = useCallback((params) => {
    setEdges((eds) => addEdge({
      ...params,
      animated: true,
      style: { stroke: '#4a6cf7', strokeWidth: 2 },
    }, eds))

    setNodes((nds) => nds.map((n) => {
      if (n.id === params.source || n.id === params.target) {
        return { ...n, data: { ...n.data, connected: true } }
      }
      return n
    }))
  }, [setEdges, setNodes])

  function handleDeleteEdge(edgeId) {
    const edge = edges.find(e => e.id === edgeId)
    if (!edge) return

    setEdges((eds) => eds.filter(e => e.id !== edgeId))

    setNodes((nds) => nds.map((n) => {
      const stillConnected = edges.some(
        e => e.id !== edgeId && (e.source === n.id || e.target === n.id)
      )
      if ((n.id === edge.source || n.id === edge.target) && !stillConnected) {
        return { ...n, data: { ...n.data, connected: false } }
      }
      return n
    }))
  }

  const mappingCount = edges.length

  function handleExport() {
    const mapping = {}
    edges.forEach(edge => {
      const srcNode = nodes.find(n => n.id === edge.source)
      const tgtNode = nodes.find(n => n.id === edge.target)
      if (srcNode && tgtNode) {
        mapping[srcNode.data.label] = tgtNode.data.label
      }
    })

    const outputRows = sourceRows.map(row => {
      const newRow = {}
      Object.entries(mapping).forEach(([src, tgt]) => {
        newRow[tgt] = row[src] ?? ''
      })
      return newRow
    })

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(outputRows.length > 0 ? outputRows : [mapping])
    XLSX.utils.book_append_sheet(wb, ws, '轉換結果')
    XLSX.writeFile(wb, '轉換結果.xlsx')
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <button className={styles.backBtn} onClick={onBack}>← 重新上傳</button>
        <div className={styles.info}>
          <span className={styles.badge}>{sourceFields.length} 個來源欄位</span>
          <span className={styles.arrow}>→</span>
          <span className={styles.badge}>{targetFields.length} 個目標欄位</span>
          {mappingCount > 0 && (
            <span className={styles.badgeGreen}>已對應 {mappingCount} 組</span>
          )}
        </div>
        <button
          className={styles.exportBtn}
          disabled={mappingCount === 0}
          onClick={handleExport}
        >
          匯出對應結果 ({mappingCount})
        </button>
      </div>

      <div className={styles.legends}>
        <div className={styles.legend}>
          <div className={styles.legendDot} style={{ background: '#f8f9ff', border: '1.5px solid #c5ceff' }} />
          <span>來源欄位（拖曳右側連接點）</span>
        </div>
        <div className={styles.legend}>
          <div className={styles.legendDot} style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0' }} />
          <span>目標欄位（接受左側連線）</span>
        </div>
        <div className={styles.legend}>
          <span style={{ color: '#999', fontSize: 12 }}>點擊連線可刪除對應</span>
        </div>
      </div>

      <div className={styles.canvas}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgeClick={(_, edge) => handleDeleteEdge(edge.id)}
          nodeTypes={NODE_TYPES}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          deleteKeyCode={null}
        >
          <Background gap={16} color="#f0f0f0" />
          <Controls />
          <MiniMap
            nodeColor={(n) => n.type === 'sourceField' ? '#c5ceff' : '#bbf7d0'}
            pannable
            zoomable
          />
        </ReactFlow>
      </div>
    </div>
  )
}

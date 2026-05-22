import { Handle, Position } from '@xyflow/react'
import styles from './FieldNode.module.css'

export function SourceFieldNode({ data }) {
  return (
    <div className={`${styles.node} ${styles.sourceNode} ${data.connected ? styles.connected : ''}`}>
      <span className={styles.label}>{data.label}</span>
      <Handle
        type="source"
        position={Position.Right}
        className={styles.handle}
      />
    </div>
  )
}

export function TargetFieldNode({ data }) {
  return (
    <div className={`${styles.node} ${styles.targetNode} ${data.connected ? styles.connected : ''}`}>
      <Handle
        type="target"
        position={Position.Left}
        className={styles.handle}
      />
      <span className={styles.label}>{data.label}</span>
    </div>
  )
}

import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { DotsSixVerticalIcon } from '@phosphor-icons/react'

/**
 * The reorder handle shared by to-dos, goals, projects and pending tasks.
 * Spread dnd-kit's `attributes` and `listeners` onto it; its KeyboardSensor
 * gives the keyboard alternative (Space to pick up, arrows to move).
 */
const DragHandle = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  function DragHandle(props, ref) {
    return (
      <button
        ref={ref}
        type="button"
        className="drag-handle"
        aria-label="Reorder (drag, or use arrow keys)"
        onClick={(e) => e.stopPropagation()}
        {...props}
      >
        <DotsSixVerticalIcon size={18} aria-hidden />
      </button>
    )
  }
)

export default DragHandle

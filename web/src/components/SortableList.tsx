import { useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import DragHandle from './DragHandle'
import type { Placement } from '../lib/types'

type Item = { id: number }

type Props<T extends Item> = {
  items: T[]
  /** One move: the item, where it goes relative to a neighbour, and the new order. */
  onMove: (id: number, placement: Placement, order: T[]) => void
  renderItem: (item: T, handle: ReactNode) => ReactNode
  /** Element and styling for each item's wrapper. */
  as?: 'div' | 'article'
  itemClassName?: (item: T) => string
  itemStyle?: (item: T) => CSSProperties
  /** DOM id for each item's wrapper (e.g. so another page can scroll to it). */
  itemId?: (item: T) => string
  /** e.g. "goal" → "Reorder goal (drag, or use arrow keys)" */
  noun?: string
  className?: string
  style?: CSSProperties
  /** Items that can't be dragged yet (e.g. not saved). */
  isLocked?: (item: T) => boolean
  /** "grid" for cards laid out in rows (goal cards): the drop line runs down the side. */
  layout?: 'list' | 'grid'
  /** Rendered in the same container after the items (e.g. the Goals page's open slots). */
  after?: ReactNode
}

/**
 * A manually ordered list (to-dos, goals, sub-goals, projects, pending
 * tasks). Drag the handle with mouse or touch, or use the keyboard: Space to
 * pick up and arrows to move, or just ArrowUp/ArrowDown on the focused handle
 * to move one place. Items stay put while dragging; the dragged one fades to
 * 40% and a cyan line shows where it will land. One move = one onMove call.
 */
export default function SortableList<T extends Item>(props: Props<T>) {
  const { items, onMove, renderItem, className, style } = props
  const [activeId, setActiveId] = useState<number | null>(null)
  const [overId, setOverId] = useState<number | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function moveTo(id: number, toIndex: number) {
    const from = items.findIndex((i) => i.id === id)
    if (from < 0 || toIndex < 0 || toIndex >= items.length || toIndex === from) return
    const target = items[toIndex]
    const placement: Placement = toIndex < from ? { before_id: target.id } : { after_id: target.id }
    onMove(id, placement, arrayMove(items, from, toIndex))
  }

  function reset() {
    setActiveId(null)
    setOverId(null)
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    reset()
    if (!over || over.id === active.id) return
    moveTo(Number(active.id), items.findIndex((i) => i.id === Number(over.id)))
  }

  const activeIndex = items.findIndex((i) => i.id === activeId)
  const activeItem = activeIndex >= 0 ? items[activeIndex] : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(e) => setActiveId(Number(e.active.id))}
      onDragOver={(e) => setOverId(e.over ? Number(e.over.id) : null)}
      onDragEnd={onDragEnd}
      onDragCancel={reset}
    >
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={props.layout === 'grid' ? rectSortingStrategy : verticalListSortingStrategy}
      >
        <div className={className} style={style}>
          {items.map((item, index) => {
            let dropEdge: 'top' | 'bottom' | null = null
            if (activeId !== null && overId === item.id && activeId !== item.id) {
              dropEdge = index < activeIndex ? 'top' : 'bottom'
            }
            return (
              <SortableItem
                key={item.id}
                item={item}
                index={index}
                props={props}
                dropEdge={dropEdge}
                dragActive={activeId !== null}
                onArrow={(dir) => moveTo(item.id, index + dir)}
              />
            )
          })}
          {props.after}
        </div>
      </SortableContext>
      <DragOverlay dropAnimation={null}>
        {activeItem ? (
          <Wrapper
            as={props.as}
            className={`${props.itemClassName?.(activeItem) ?? ''} drag-overlay`}
            style={props.itemStyle?.(activeItem)}
          >
            {renderItem(activeItem, <DragHandle tabIndex={-1} aria-hidden />)}
          </Wrapper>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

function Wrapper({
  as = 'div',
  ...rest
}: { as?: 'div' | 'article'; className?: string; style?: CSSProperties; children: ReactNode }) {
  const Tag = as
  return <Tag {...rest} />
}

function SortableItem<T extends Item>({
  item,
  props,
  dropEdge,
  dragActive,
  onArrow,
}: {
  item: T
  index: number
  props: Props<T>
  dropEdge: 'top' | 'bottom' | null
  dragActive: boolean
  onArrow: (dir: -1 | 1) => void
}) {
  const locked = props.isLocked?.(item) ?? false
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useSortable({
    id: item.id,
    disabled: locked,
  })
  const Tag = props.as ?? 'div'

  const grid = props.layout === 'grid'
  const lineShadow =
    dropEdge === 'top'
      ? grid
        ? 'inset 3px 0 0 var(--color-accent)'
        : 'inset 0 2px 0 var(--color-accent)'
      : dropEdge === 'bottom'
        ? grid
          ? 'inset -3px 0 0 var(--color-accent)'
          : 'inset 0 -2px 0 var(--color-accent)'
        : undefined

  const handle = (
    <DragHandle
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`Reorder${props.noun ? ` ${props.noun}` : ''} (drag, or use arrow keys)`}
      disabled={locked}
      onKeyDown={(e: KeyboardEvent<HTMLButtonElement>) => {
        listeners?.onKeyDown?.(e)
        if (dragActive || e.defaultPrevented) return
        const back = e.key === 'ArrowUp' || (grid && e.key === 'ArrowLeft')
        const forward = e.key === 'ArrowDown' || (grid && e.key === 'ArrowRight')
        if (back || forward) {
          e.preventDefault()
          onArrow(back ? -1 : 1)
        }
      }}
    />
  )

  return (
    <Tag
      ref={setNodeRef}
      id={props.itemId?.(item)}
      className={props.itemClassName?.(item)}
      style={{
        ...props.itemStyle?.(item),
        opacity: isDragging ? 0.4 : undefined,
        boxShadow: lineShadow,
      }}
    >
      {props.renderItem(item, handle)}
    </Tag>
  )
}

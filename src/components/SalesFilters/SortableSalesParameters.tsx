import { DndContext, PointerSensor, TouchSensor, KeyboardSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, sortableKeyboardCoordinates, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import styles from './SalesFilters.module.css';

export type SalesParameter = { field: string; label: string; checked: boolean };
type Props = {
  items: SalesParameter[];
  onToggle: (field: string) => void;
  onOrderChange?: (fields: string[]) => void;
};

function ParameterCard({ item, level, onToggle, draggable, onMove, canUp, canDown }: {
  item: SalesParameter; level?: number; onToggle: (field: string) => void; draggable: boolean; onMove: (field: string, direction: number) => void; canUp: boolean; canDown: boolean;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.field, disabled: !draggable });
  return (
    <div ref={setNodeRef}
      className={`${item.checked ? styles.optionCardActive : styles.optionCard} ${styles.sortableParameter}`}
      style={{ transform: CSS.Transform.toString(transform), transition, position: 'relative', zIndex: isDragging ? 2 : undefined, opacity: isDragging ? 0.7 : 1 }}>
      <label className={styles.parameterLabel}>
        <input type="checkbox" checked={item.checked} onChange={() => onToggle(item.field)} />
        <span>{level ? `${level}. ` : ''}{item.label}</span>
      </label>
      {draggable && <div className={styles.moveButtons}>
        <button type="button" disabled={!canUp} onClick={() => onMove(item.field, -1)} aria-label={`Підняти «${item.label}» вище`}>↑</button>
        <button type="button" disabled={!canDown} onClick={() => onMove(item.field, 1)} aria-label={`Опустити «${item.label}» нижче`}>↓</button>
      </div>}
      {draggable ? (
        <button ref={setActivatorNodeRef} type="button" className={styles.dragHandle}
          {...attributes} {...listeners} aria-label={`Перемістити параметр «${item.label}»`}
          title="Перетягніть, щоб змінити порядок">⠿</button>
      ) : null}
    </div>
  );
}

export default function SortableSalesParameters({ items, onToggle, onOrderChange }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const move = (field: string, direction: number) => {
    if (!onOrderChange) return;
    const index = items.findIndex(item => item.field === field);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= items.length) return;
    onOrderChange(arrayMove(items.map(item => item.field), index, target));
  };
  const active = items.filter(item => item.checked).map(item => item.field);
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter}
      accessibility={{ screenReaderInstructions: { draggable: 'Натисніть пробіл, щоб підняти параметр. Переміщуйте стрілками, натисніть пробіл для підтвердження або Escape для скасування.' } }}
      onDragEnd={({ active: dragged, over }) => {
        if (!over || dragged.id === over.id || !onOrderChange) return;
        const from = items.findIndex(item => item.field === dragged.id);
        const to = items.findIndex(item => item.field === over.id);
        if (from >= 0 && to >= 0) onOrderChange(arrayMove(items.map(item => item.field), from, to));
      }}>
      <SortableContext items={items.map(item => item.field)} strategy={rectSortingStrategy}>
        <div className={styles.optionGrid}>
          {items.map(item => (
            <ParameterCard key={item.field} item={item} onToggle={onToggle}
              draggable={Boolean(onOrderChange)} onMove={move} canUp={items[0]?.field !== item.field} canDown={items[items.length - 1]?.field !== item.field} level={item.checked ? active.indexOf(item.field) + 1 : undefined} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

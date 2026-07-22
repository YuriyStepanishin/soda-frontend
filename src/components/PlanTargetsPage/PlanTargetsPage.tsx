import React, { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Select, { type MultiValue } from 'react-select';
import { fetchSales, type Sale } from '../../api/fetchSales';
import { queryKeys } from '../../api/queryKeys';
import Loader from '../Loader/Loader';
import Popup from '../Popup/Popup';
import {
  CALCULATION_MODE_OPTIONS,
  METRIC_BASE_OPTIONS,
  METRIC_UNIT_OPTIONS,
  type PlanColumn,
  type CalculationMode,
  BRAND_OPTIONS,
  buildMetricType,
  inferMetricControls,
  metricLabel,
  loadPlanColumns,
  savePlanColumns,
  sortPlanColumns,
  thresholdLabel,
  type MetricBase,
  type MetricUnit,
} from '../ImplementationPage/planColumnsStorage';
import {
  ALL_AGENTS,
  DEPARTMENT_ORDER,
  type BrandFilter,
  getBrandLabel,
  matchesBrand,
} from '../ImplementationPage/agentsConfig';
import styles from './PlanTargetsPage.module.css';

type Props = {
  onBack: () => void;
};

function buildEmpty(): PlanColumn {
  const deptMode: Record<string, 'total' | 'individual'> = {};
  const deptPlans: Record<string, number> = {};
  for (const d of DEPARTMENT_ORDER) {
    deptMode[d.dept] = 'individual';
    deptPlans[d.dept] = 0;
  }
  return {
    id: crypto.randomUUID(),
    label: '',
    displayOrder: 0,
    brand: 'jockey',
    metric: 'tt_from_x',
    threshold: 0,
    agentPlans: Object.fromEntries(ALL_AGENTS.map(a => [a, 0])),
    deptMode,
    deptPlans,
  };
}

export default function PlanTargetsPage({ onBack }: Props) {
  const queryClient = useQueryClient();
  const [columns, setColumns] = useState<PlanColumn[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [editing, setEditing] = useState<PlanColumn | null>(null);
  const [saved, setSaved] = useState(false);
  const [popupMessage, setPopupMessage] = useState<string | null>(null);
  const { data: sales = [] } = useQuery<Sale[]>({
    queryKey: queryKeys.sales,
    queryFn: fetchSales,
    staleTime: 1000 * 60 * 5,
  });
  const { data: loadedColumns = [], isLoading } = useQuery<PlanColumn[]>({
    queryKey: queryKeys.planTargets,
    queryFn: loadPlanColumns,
    staleTime: 1000 * 60 * 5,
  });

  const effectiveColumns = useMemo(
    () => (isDirty ? sortPlanColumns(columns) : sortPlanColumns(loadedColumns)),
    [columns, isDirty, loadedColumns]
  );

  const saveMutation = useMutation({
    mutationFn: savePlanColumns,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.planTargets }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.infoBoardPlanTargets,
        }),
      ]);
      setSaved(true);
      setPopupMessage('Збережено');
      setTimeout(() => setSaved(false), 2000);
    },
    onError: () => {
      setPopupMessage('Помилка...');
    },
  });

  const handleSaveAll = useCallback(() => {
    void saveMutation.mutateAsync(sortPlanColumns(effectiveColumns));
  }, [effectiveColumns, saveMutation]);

  function handleAddColumn() {
    const nextOrder =
      effectiveColumns.reduce(
        (max, col) => Math.max(max, Math.trunc(col.displayOrder ?? 0)),
        0
      ) + 1;
    setEditing({ ...buildEmpty(), displayOrder: nextOrder });
  }

  function handleEditColumn(col: PlanColumn) {
    // ensure all agents present
    const plans = { ...col.agentPlans };
    for (const a of ALL_AGENTS) {
      if (!(a in plans)) plans[a] = 0;
    }
    setEditing({ ...col, agentPlans: plans });
  }

  function handleDeleteColumn(id: string) {
    setIsDirty(true);
    setColumns(sortPlanColumns(effectiveColumns.filter(c => c.id !== id)));
  }

  function handleSaveColumn(col: PlanColumn) {
    setIsDirty(true);
    const currentColumns = effectiveColumns;
    const idx = currentColumns.findIndex(c => c.id === col.id);
    if (idx >= 0) {
      const next = [...currentColumns];
      next[idx] = col;
      setColumns(sortPlanColumns(next));
    } else {
      setColumns(sortPlanColumns([...currentColumns, col]));
    }
    setEditing(null);
  }

  if (isLoading && effectiveColumns.length === 0) {
    return <Loader />;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h2 className={styles.title}>Планові показники</h2>
      </header>

      <div className={styles.toolbar}>
        <button
          type="button"
          className={styles.addBtn}
          onClick={handleAddColumn}
        >
          + Додати колонку
        </button>
        <button
          type="button"
          className={styles.saveAllBtn}
          onClick={handleSaveAll}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending
            ? 'Збереження...'
            : saved
              ? '✓ Збережено'
              : 'Зберегти всі'}
        </button>
      </div>

      {effectiveColumns.length === 0 ? (
        <p className={styles.empty}>
          Немає колонок. Натисніть «+ Додати колонку».
        </p>
      ) : (
        <PersonnelTable
          columns={effectiveColumns}
          onEdit={handleEditColumn}
          onDelete={handleDeleteColumn}
        />
      )}

      <button type="button" className={styles.backBtn} onClick={onBack}>
        ← Назад
      </button>

      {editing && (
        <ColumnEditorModal
          column={editing}
          sales={sales}
          onSave={handleSaveColumn}
          onCancel={() => setEditing(null)}
        />
      )}

      {popupMessage && (
        <Popup message={popupMessage} onClose={() => setPopupMessage(null)} />
      )}
    </div>
  );
}

// ─── Personnel Table ──────────────────────────────────────────────────────────

type PersonnelTableProps = {
  columns: PlanColumn[];
  onEdit: (col: PlanColumn) => void;
  onDelete: (id: string) => void;
};

function PersonnelTable({ columns, onEdit, onDelete }: PersonnelTableProps) {
  return (
    <>
      {/* Desktop view: single table with all columns */}
      <div className={styles.desktopTable}>
        <div className={styles.tableWrapper}>
          <table className={styles.personnelTable}>
            <thead>
              <tr>
                <th className={styles.thName}>Персонал</th>
                {columns.map(col => (
                  <th key={col.id} className={styles.thColumn}>
                    <div className={styles.colHeader}>
                      <span className={styles.colTitle}>
                        {col.label || '(без назви)'}
                      </span>
                      <span className={styles.colSubtitle}>
                        {metricLabel(col.metric, col.threshold)}
                      </span>
                    </div>
                    <div className={styles.colActions}>
                      <button
                        type="button"
                        className={styles.tableIconBtn}
                        onClick={() => onEdit(col)}
                        title="Редагувати"
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className={styles.tableIconBtn}
                        onClick={() => onDelete(col.id)}
                        title="Видалити"
                      >
                        ✕
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DEPARTMENT_ORDER.map(dept => (
                <React.Fragment key={dept.dept}>
                  {/* Department header */}
                  <tr className={styles.deptGroupHeader}>
                    <td className={styles.deptName}>
                      <strong>{dept.label}</strong>
                    </td>
                    {columns.map(col => {
                      const deptTotal = dept.agents.reduce(
                        (sum, agent) => sum + (col.agentPlans[agent] ?? 0),
                        0
                      );
                      return (
                        <td
                          key={`dept-total-${dept.dept}-${col.id}`}
                          className={styles.deptTotal}
                        >
                          <div className={styles.deptTotalValue}>
                            {deptTotal}
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Department agents */}
                  {dept.agents.map(agent => (
                    <tr key={agent} className={styles.tableAgentRow}>
                      <td className={styles.tdName}>{agent}</td>
                      {columns.map(col => (
                        <td
                          key={`${agent}-${col.id}`}
                          className={styles.tdValue}
                        >
                          <span className={styles.cellValue}>
                            {col.agentPlans[agent] ?? 0}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}

                  {/* Department subtotal */}
                </React.Fragment>
              ))}

              {/* Grand total */}
              <tr className={styles.grandTotalRow}>
                <td className={styles.grandTotalLabel}>
                  <strong>Всього</strong>
                </td>
                {columns.map(col => {
                  const grandTotal = DEPARTMENT_ORDER.reduce(
                    (sum, dept) =>
                      sum +
                      dept.agents.reduce(
                        (deptSum, agent) =>
                          deptSum + (col.agentPlans[agent] ?? 0),
                        0
                      ),
                    0
                  );
                  return (
                    <td
                      key={`grand-total-${col.id}`}
                      className={styles.grandTotalCell}
                    >
                      <strong>{grandTotal}</strong>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile view: columns grouped by page size */}
      <div className={styles.mobileTable}>
        <div className={styles.mobileTablePage}>
          <div className={`${styles.mobileTableGrid} ${styles.grid1}`}>
            {columns.map(col => (
              <div key={col.id} className={styles.mobileTableContainer}>
                <div className={styles.mobileTableHeader}>
                  <div>
                    <div className={styles.mobileColTitle}>
                      {col.label || '(без назви)'}
                    </div>
                    <div className={styles.mobileColSubtitle}>
                      {metricLabel(col.metric, col.threshold)}
                    </div>
                  </div>
                  <div className={styles.mobileColActions}>
                    <button
                      type="button"
                      className={styles.tableIconBtn}
                      onClick={() => onEdit(col)}
                      title="Редагувати"
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className={styles.tableIconBtn}
                      onClick={() => onDelete(col.id)}
                      title="Видалити"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <table className={styles.personnelTable}>
                  <thead>
                    <tr>
                      <th className={styles.thName}>Персонал</th>
                      <th className={styles.mobileThValue}>Значення</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DEPARTMENT_ORDER.map(dept => (
                      <React.Fragment key={dept.dept}>
                        {/* Department header */}
                        <tr className={styles.deptGroupHeader}>
                          <td className={styles.deptName} colSpan={2}>
                            <strong>{dept.label}</strong>
                          </td>
                        </tr>

                        {/* Department agents */}
                        {dept.agents.map(agent => (
                          <tr key={agent} className={styles.tableAgentRow}>
                            <td className={styles.tdName}>{agent}</td>
                            <td className={styles.tdValue}>
                              <span className={styles.cellValue}>
                                {col.agentPlans[agent] ?? 0}
                              </span>
                            </td>
                          </tr>
                        ))}

                        {/* Department subtotal */}
                        <tr className={styles.deptSubtotal}>
                          <td className={styles.subtotalLabel}>
                            <strong>{dept.label} – разом</strong>
                          </td>
                          <td className={styles.subtotalValue}>
                            <strong>
                              {dept.agents.reduce(
                                (sum, agent) =>
                                  sum + (col.agentPlans[agent] ?? 0),
                                0
                              )}
                            </strong>
                          </td>
                        </tr>
                      </React.Fragment>
                    ))}

                    {/* Grand total */}
                    <tr className={styles.grandTotalRow}>
                      <td className={styles.grandTotalLabel}>
                        <strong>Всього</strong>
                      </td>
                      <td className={styles.grandTotalCell}>
                        <strong>
                          {DEPARTMENT_ORDER.reduce(
                            (sum, dept) =>
                              sum +
                              dept.agents.reduce(
                                (deptSum, agent) =>
                                  deptSum + (col.agentPlans[agent] ?? 0),
                                0
                              ),
                            0
                          )}
                        </strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Column Editor Modal ─────────────────────────────────────────────────────

type ColumnEditorModalProps = {
  column: PlanColumn;
  sales: Sale[];
  onSave: (col: PlanColumn) => void;
  onCancel: () => void;
};

function parseNum(v: string): number {
  return Number(v.replace(',', '.')) || 0;
}

function summarizeSelection(values: string[], emptyLabel: string): string {
  if (values.length === 0) return emptyLabel;
  if (values.length <= 2) return values.join(', ');
  return `${values.slice(0, 2).join(', ')} +${values.length - 2}`;
}

type SelectOption<T extends string = string> = { value: T; label: string };

function normalizeText(value: string): string {
  return value
    .replace(/\u00A0/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('uk-UA');
}

function ColumnEditorModal({
  column,
  sales,
  onSave,
  onCancel,
}: ColumnEditorModalProps) {
  const [label, setLabel] = useState(column.label);
  const [displayOrder, setDisplayOrder] = useState(
    column.displayOrder ? String(column.displayOrder) : ''
  );
  const [selectedBrands, setSelectedBrands] = useState<BrandFilter[]>(() =>
    column.brands && column.brands.length > 0 ? column.brands : [column.brand]
  );
  const controls = useMemo(
    () => inferMetricControls(column.metric),
    [column.metric]
  );
  const [metricBase, setMetricBase] = useState<MetricBase>(controls.base);
  const [metricUnit, setMetricUnit] = useState<MetricUnit>(controls.unit);
  const [calcMode, setCalcMode] = useState<CalculationMode>(
    column.calcMode ?? 'period'
  );
  const [threshold, setThreshold] = useState(String(column.threshold));
  const [assortmentMode, setAssortmentMode] = useState(
    column.assortmentMode ?? 'all'
  );
  const [selectedAssortmentProducts, setSelectedAssortmentProducts] = useState(
    () =>
      column.assortmentProducts && column.assortmentProducts.length > 0
        ? column.assortmentProducts
        : column.assortmentProduct
          ? [column.assortmentProduct]
          : []
  );
  const [plans, setPlans] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      ALL_AGENTS.map(a => [a, String(column.agentPlans[a] ?? 0)])
    )
  );
  const [deptMode] = useState<Record<string, 'total' | 'individual'>>(() => {
    const modes: Record<string, 'total' | 'individual'> = {};
    for (const d of DEPARTMENT_ORDER) {
      modes[d.dept] = column.deptMode?.[d.dept] ?? 'individual';
    }
    return modes;
  });
  const [deptPlans, setDeptPlans] = useState<Record<string, string>>(() => {
    const dp: Record<string, string> = {};
    for (const d of DEPARTMENT_ORDER) {
      dp[d.dept] = String(column.deptPlans?.[d.dept] ?? 0);
    }
    return dp;
  });
  const [showCalcModal, setShowCalcModal] = useState(false);

  const brandOptions = useMemo(() => {
    const firstBrand = selectedBrands[0] ?? column.brand;
    if (BRAND_OPTIONS.some(option => option.value === firstBrand))
      return BRAND_OPTIONS;
    return [
      { value: firstBrand, label: getBrandLabel(firstBrand) },
      ...BRAND_OPTIONS,
    ];
  }, [selectedBrands, column.brand]);

  const assortmentOptions = useMemo(() => {
    const seen = new Set<string>();
    return sales
      .filter(item => item.товар && item.бренд)
      .filter(item =>
        selectedBrands.some(selectedBrand =>
          matchesBrand(item.бренд, selectedBrand)
        )
      )
      .map(item => item.товар.trim())
      .filter(item => {
        const key = normalizeText(item);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => a.localeCompare(b, 'uk-UA'));
  }, [sales, selectedBrands]);

  const brandSelectOptions = useMemo<SelectOption<BrandFilter>[]>(
    () => brandOptions.map(o => ({ value: o.value, label: o.label })),
    [brandOptions]
  );

  const assortmentSelectOptions = useMemo<SelectOption[]>(
    () => assortmentOptions.map(o => ({ value: o, label: o })),
    [assortmentOptions]
  );

  const departmentTotals = DEPARTMENT_ORDER.map(dept => {
    const mode = deptMode[dept.dept] ?? 'individual';
    const total =
      mode === 'total'
        ? parseNum(deptPlans[dept.dept] ?? '0')
        : dept.agents.reduce(
            (agentSum, agent) => agentSum + parseNum(plans[agent] ?? '0'),
            0
          );
    return { dept: dept.dept, total };
  });

  const overallTotal = departmentTotals.reduce(
    (sum, dept) => sum + dept.total,
    0
  );

  function handlePlanChange(agent: string, val: string) {
    if (val !== '' && !/^\d*([.,]\d{0,2})?$/.test(val)) return;
    setPlans(prev => ({ ...prev, [agent]: val }));
  }

  function handleDeptPlanChange(dept: string, val: string) {
    if (val !== '' && !/^\d*([.,]\d{0,2})?$/.test(val)) return;
    setDeptPlans(prev => ({ ...prev, [dept]: val }));
  }

  function handleSave() {
    const agentPlans: Record<string, number> = {};
    for (const a of ALL_AGENTS) {
      agentPlans[a] = parseNum(plans[a] ?? '0');
    }
    const deptModeSaved: Record<string, 'total' | 'individual'> = {};
    const deptPlansSaved: Record<string, number> = {};
    for (const d of DEPARTMENT_ORDER) {
      deptModeSaved[d.dept] = deptMode[d.dept];
      deptPlansSaved[d.dept] = parseNum(deptPlans[d.dept] ?? '0');
    }
    const metric = buildMetricType(metricBase, metricUnit, metricBase === 'tt');
    const normalizedDisplayOrder = Math.max(
      1,
      Math.trunc(Number(displayOrder) || 1)
    );
    onSave({
      id: column.id,
      label: label.trim(),
      displayOrder: normalizedDisplayOrder,
      brand: selectedBrands[0] ?? column.brand,
      brands: selectedBrands,
      assortmentMode,
      calcMode: metricBase === 'tt' ? calcMode : 'period',
      assortmentProduct:
        assortmentMode === 'specific'
          ? (selectedAssortmentProducts[0] ?? '')
          : '',
      assortmentProducts:
        assortmentMode === 'specific' ? selectedAssortmentProducts : [],
      metric,
      threshold: metricBase === 'tt' ? parseNum(threshold) : 0,
      agentPlans,
      deptMode: deptModeSaved,
      deptPlans: deptPlansSaved,
    });
  }

  return (
    <>
      {/* Backdrop */}
      <div className={styles.modalBackdrop} onClick={onCancel} />

      {/* Modal */}
      <div className={styles.modalDialog}>
        <div className={styles.modalContent}>
          <div className={styles.modalHeader}>
            <h2 className={styles.modalTitle}>
              {column.label ? `Редагувати: ${column.label}` : 'Нова колонка'}
            </h2>
            <button
              type="button"
              className={styles.modalClose}
              onClick={onCancel}
            >
              ✕
            </button>
          </div>

          <div className={styles.modalBody}>
            <div className={styles.editorForm}>
              {/* Назва */}
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Назва колонки</label>
                <input
                  className={styles.formInput}
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  placeholder="напр. АКБ Жокей"
                />
              </div>

              <div className={styles.formRow}>
                <label className={styles.formLabel}>Номер стовпця</label>
                <input
                  className={styles.formInput}
                  type="number"
                  min={1}
                  step={1}
                  value={displayOrder}
                  onChange={e => setDisplayOrder(e.target.value)}
                  placeholder="1"
                />
              </div>

              {/* ТМ */}
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Торгова марка</label>
                <span className={styles.formHint}>
                  {summarizeSelection(
                    selectedBrands.map(getBrandLabel),
                    'Оберіть одну або кілька ТМ'
                  )}
                </span>
                <Select
                  isMulti
                  closeMenuOnSelect={false}
                  hideSelectedOptions={false}
                  options={brandSelectOptions}
                  value={brandSelectOptions.filter(option =>
                    selectedBrands.includes(option.value)
                  )}
                  onChange={(newValue: MultiValue<SelectOption<BrandFilter>>) =>
                    setSelectedBrands(newValue.map(option => option.value))
                  }
                  placeholder="Оберіть одну або кілька ТМ"
                  classNamePrefix="multiDropdown"
                  menuPortalTarget={document.body}
                  styles={{
                    menuPortal: base => ({ ...base, zIndex: 1200 }),
                    control: (base, state) => ({
                      ...base,
                      backgroundColor: '#ffffff',
                      borderColor: state.isFocused ? '#1976d2' : '#9ca3af',
                      boxShadow: state.isFocused
                        ? '0 0 0 2px rgba(25, 118, 210, 0.18)'
                        : 'none',
                      minHeight: 40,
                    }),
                    menu: base => ({
                      ...base,
                      backgroundColor: '#ffffff',
                      border: '1px solid #d1d5db',
                      boxShadow: '0 10px 24px rgba(0, 0, 0, 0.14)',
                    }),
                    option: (base, state) => ({
                      ...base,
                      backgroundColor: state.isSelected
                        ? '#1976d2'
                        : state.isFocused
                          ? '#e3f2fd'
                          : '#ffffff',
                      color: state.isSelected ? '#ffffff' : '#111827',
                      fontWeight: state.isSelected ? 700 : 500,
                    }),
                    placeholder: base => ({ ...base, color: '#6b7280' }),
                    singleValue: base => ({ ...base, color: '#111827' }),
                    input: base => ({ ...base, color: '#111827' }),
                    multiValue: base => ({
                      ...base,
                      backgroundColor: '#e8f0fe',
                    }),
                    multiValueLabel: base => ({
                      ...base,
                      color: '#1f3a8a',
                      fontWeight: 600,
                    }),
                    multiValueRemove: base => ({
                      ...base,
                      color: '#1f3a8a',
                      ':hover': {
                        backgroundColor: '#dbeafe',
                        color: '#1e40af',
                      },
                    }),
                    indicatorSeparator: base => ({
                      ...base,
                      backgroundColor: '#d1d5db',
                    }),
                    dropdownIndicator: (base, state) => ({
                      ...base,
                      color: state.isFocused ? '#1976d2' : '#4b5563',
                      ':hover': {
                        color: '#1976d2',
                      },
                    }),
                    clearIndicator: base => ({
                      ...base,
                      color: '#4b5563',
                      ':hover': {
                        color: '#111827',
                      },
                    }),
                  }}
                />
                <div className={styles.assortmentModeRadioGroup}>
                  <label className={styles.assortmentModeRadioItem}>
                    <input
                      type="radio"
                      name={`assortment-mode-${column.id}`}
                      checked={assortmentMode === 'all'}
                      onChange={() => setAssortmentMode('all')}
                    />
                    <span>Увесь асортимент</span>
                  </label>
                  <label className={styles.assortmentModeRadioItem}>
                    <input
                      type="radio"
                      name={`assortment-mode-${column.id}`}
                      checked={assortmentMode === 'specific'}
                      onChange={() => setAssortmentMode('specific')}
                    />
                    <span>Визначений асортимент</span>
                  </label>
                </div>
              </div>

              {assortmentMode === 'specific' && (
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>
                    Визначений асортимент
                  </label>
                  <span className={styles.formHint}>
                    {summarizeSelection(
                      selectedAssortmentProducts,
                      'Оберіть одну або кілька позицій'
                    )}
                  </span>
                  <Select
                    isMulti
                    closeMenuOnSelect={false}
                    hideSelectedOptions={false}
                    options={assortmentSelectOptions}
                    value={assortmentSelectOptions.filter(option =>
                      selectedAssortmentProducts.includes(option.value)
                    )}
                    onChange={(newValue: MultiValue<SelectOption>) =>
                      setSelectedAssortmentProducts(
                        newValue.map(option => option.value)
                      )
                    }
                    placeholder="Оберіть одну або кілька позицій"
                    noOptionsMessage={() => 'Немає доступних позицій'}
                    classNamePrefix="multiDropdown"
                    menuPortalTarget={document.body}
                    styles={{
                      menuPortal: base => ({ ...base, zIndex: 1200 }),
                      control: (base, state) => ({
                        ...base,
                        backgroundColor: '#ffffff',
                        borderColor: state.isFocused ? '#1976d2' : '#9ca3af',
                        boxShadow: state.isFocused
                          ? '0 0 0 2px rgba(25, 118, 210, 0.18)'
                          : 'none',
                        minHeight: 40,
                      }),
                      menu: base => ({
                        ...base,
                        backgroundColor: '#ffffff',
                        border: '1px solid #d1d5db',
                        boxShadow: '0 10px 24px rgba(0, 0, 0, 0.14)',
                      }),
                      option: (base, state) => ({
                        ...base,
                        backgroundColor: state.isSelected
                          ? '#1976d2'
                          : state.isFocused
                            ? '#e3f2fd'
                            : '#ffffff',
                        color: state.isSelected ? '#ffffff' : '#111827',
                        fontWeight: state.isSelected ? 700 : 500,
                      }),
                      placeholder: base => ({ ...base, color: '#6b7280' }),
                      singleValue: base => ({ ...base, color: '#111827' }),
                      input: base => ({ ...base, color: '#111827' }),
                      multiValue: base => ({
                        ...base,
                        backgroundColor: '#e8f0fe',
                      }),
                      multiValueLabel: base => ({
                        ...base,
                        color: '#1f3a8a',
                        fontWeight: 600,
                      }),
                      multiValueRemove: base => ({
                        ...base,
                        color: '#1f3a8a',
                        ':hover': {
                          backgroundColor: '#dbeafe',
                          color: '#1e40af',
                        },
                      }),
                      indicatorSeparator: base => ({
                        ...base,
                        backgroundColor: '#d1d5db',
                      }),
                      dropdownIndicator: (base, state) => ({
                        ...base,
                        color: state.isFocused ? '#1976d2' : '#4b5563',
                        ':hover': {
                          color: '#1976d2',
                        },
                      }),
                      clearIndicator: base => ({
                        ...base,
                        color: '#4b5563',
                        ':hover': {
                          color: '#111827',
                        },
                      }),
                    }}
                  />
                </div>
              )}

              {/* Кнопка для модального вікна розрахунку */}
              <div className={styles.formRow}>
                <button
                  type="button"
                  className={styles.calcMethodBtn}
                  onClick={() => setShowCalcModal(true)}
                >
                  Методи розрахунку (Сума, кількість, SKU)
                </button>
              </div>

              {/* Плани по агентах */}
              <h3 className={styles.agentsTitle}>Плани по агентах</h3>

              <div className={styles.agentsTable}>
                {DEPARTMENT_ORDER.map(dept => {
                  const mode = deptMode[dept.dept] ?? 'individual';
                  const deptTotal =
                    departmentTotals.find(item => item.dept === dept.dept)
                      ?.total ?? 0;
                  return (
                    <div key={dept.dept} className={styles.deptBlock}>
                      <div className={styles.deptHeader}>
                        <span>{dept.label}</span>
                        <span className={styles.deptHeaderTotal}>
                          {deptTotal.toLocaleString('uk-UA')}
                        </span>
                      </div>

                      {mode === 'total' ? (
                        <div className={styles.agentRow}>
                          <span className={styles.agentName}>
                            План по відділу
                          </span>
                          <input
                            className={styles.planInput}
                            type="text"
                            inputMode="decimal"
                            value={deptPlans[dept.dept] ?? '0'}
                            onChange={e =>
                              handleDeptPlanChange(dept.dept, e.target.value)
                            }
                          />
                        </div>
                      ) : (
                        dept.agents.map(agent => (
                          <div key={agent} className={styles.agentRow}>
                            <span className={styles.agentName}>{agent}</span>
                            <input
                              className={styles.planInput}
                              type="text"
                              inputMode="decimal"
                              value={plans[agent] ?? '0'}
                              onChange={e =>
                                handlePlanChange(agent, e.target.value)
                              }
                            />
                          </div>
                        ))
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Динамічні підсумки */}
              <div className={styles.totalsSection}>
                <h3 className={styles.agentsTitle}>Підсумки</h3>
                <div className={styles.modalGrandTotalRow}>
                  <span className={styles.agentName}>Загалом</span>
                  <span className={styles.grandTotalValue}>
                    {overallTotal.toLocaleString('uk-UA')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button
              type="button"
              className={styles.saveAllBtn}
              onClick={handleSave}
            >
              Зберегти колонку
            </button>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={onCancel}
            >
              Скасувати
            </button>
          </div>
        </div>
      </div>

      {/* Calculation Methods Modal */}
      {showCalcModal && (
        <CalcMethodsModal
          metricBase={metricBase}
          metricUnit={metricUnit}
          calcMode={calcMode}
          threshold={threshold}
          onMetricBaseChange={setMetricBase}
          onMetricUnitChange={setMetricUnit}
          onCalcModeChange={setCalcMode}
          onThresholdChange={setThreshold}
          onClose={() => setShowCalcModal(false)}
        />
      )}
    </>
  );
}

// ─── Calculation Methods Modal ────────────────────────────────────────────────

type CalcMethodsModalProps = {
  metricBase: MetricBase;
  metricUnit: MetricUnit;
  calcMode: CalculationMode;
  threshold: string;
  onMetricBaseChange: (v: MetricBase) => void;
  onMetricUnitChange: (v: MetricUnit) => void;
  onCalcModeChange: (v: CalculationMode) => void;
  onThresholdChange: (v: string) => void;
  onClose: () => void;
};

function CalcMethodsModal({
  metricBase,
  metricUnit,
  calcMode,
  threshold,
  onMetricBaseChange,
  onMetricUnitChange,
  onCalcModeChange,
  onThresholdChange,
  onClose,
}: CalcMethodsModalProps) {
  const unitOptions = METRIC_UNIT_OPTIONS.filter(option => {
    if (metricBase === 'sum') return option.value !== 'sku';
    if (metricBase === 'tt') return true;
    return option.value === 'sku';
  });

  const showCalculationMode = metricBase === 'tt';
  const showThreshold = metricBase === 'tt';

  const thresholdInputLabel = thresholdLabel(
    buildMetricType('tt', metricUnit, true)
  );

  return (
    <>
      {/* Backdrop */}
      <div className={styles.modalBackdrop} onClick={onClose} />

      {/* Modal */}
      <div className={styles.calcModalDialog}>
        <div className={styles.modalContent}>
          <div className={styles.modalHeader}>
            <h2 className={styles.modalTitle}>Методи розрахунку</h2>
            <button
              type="button"
              className={styles.modalClose}
              onClick={onClose}
            >
              ✕
            </button>
          </div>

          <div className={styles.modalBody}>
            <div className={styles.calcGrid}>
              <div className={styles.calcBlock}>
                <span className={styles.calcLabel}>Показник</span>
                <div className={styles.chipRow}>
                  {METRIC_BASE_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      className={
                        metricBase === option.value
                          ? styles.chipActive
                          : styles.chipBtn
                      }
                      onClick={() => {
                        onMetricBaseChange(option.value);
                        if (option.value === 'sku') {
                          onMetricUnitChange('sku');
                        }
                        if (option.value === 'sum' && metricUnit === 'sku') {
                          onMetricUnitChange('grn');
                        }
                        if (option.value !== 'tt') {
                          onCalcModeChange('period');
                        }
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.calcBlock}>
                <span className={styles.calcLabel}>Одиниця</span>
                <div className={styles.chipRow}>
                  {unitOptions.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      className={
                        metricUnit === option.value
                          ? styles.chipActive
                          : styles.chipBtn
                      }
                      onClick={() => onMetricUnitChange(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {showCalculationMode && (
                <div className={styles.calcBlock}>
                  <span className={styles.calcLabel}>Розрахунок</span>
                  <div className={styles.chipRow}>
                    {CALCULATION_MODE_OPTIONS.map(option => (
                      <button
                        key={option.value}
                        type="button"
                        className={
                          calcMode === option.value
                            ? styles.chipActive
                            : styles.chipBtn
                        }
                        onClick={() => onCalcModeChange(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {showThreshold && (
              <div className={styles.formRow}>
                <label className={styles.formLabel}>
                  {thresholdInputLabel}
                </label>
                <input
                  className={styles.formInput}
                  type="text"
                  inputMode="decimal"
                  value={threshold}
                  onChange={e => {
                    if (/^\d*([.,]\d*)?$/.test(e.target.value))
                      onThresholdChange(e.target.value);
                  }}
                  placeholder="0"
                />
              </div>
            )}
          </div>

          <div className={styles.modalFooter}>
            <button
              type="button"
              className={styles.saveAllBtn}
              onClick={onClose}
            >
              Готово
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

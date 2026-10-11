import { Fragment, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchSalesByDays,
  fetchSalesFilters,
  type SalesByDaysRow,
} from '../../api/fetchSales';
import Loader from '../Loader/Loader';
import styles from './SalesByDaysPage.module.css';
import { openDatePicker } from '../../utils/openDatePicker';

type DayStats = {
  dateLabel: string;
  dateDisplay: string;
  dateSortValue: number;
  weekKey: string;

  weekLabel: string;

  weekSortValue: number;

  weekdayOrder: number;

  amount: number;

  weight: number;

  storesCount: number;

  tt500: number;

};



type Totals = {

  storesCount: number;

  tt500: number;

  weight: number;

  amount: number;

};



type ChartMetric = 'amount' | 'stores';



type WeekChartStats = {

  weekKey: string;

  weekLabel: string;

  weekSortValue: number;

  amount: number;

  storesCount: number;

};



function parseSimpleDate(

  input: string

): { year: number; month: number; day: number } | null {

  const trimmed = input.trim();



  if (!trimmed) return null;



  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);



  if (!match) return null;



  return {

    year: Number(match[1]),

    month: Number(match[2]),

    day: Number(match[3]),

  };

}



function formatDateDisplay(date: {

  year: number;

  month: number;

  day: number;

}): string {

  const utcDate = new Date(Date.UTC(date.year, date.month - 1, date.day));



  const weekday = new Intl.DateTimeFormat('uk-UA', {

    weekday: 'long',

  })

    .format(utcDate)

    .toUpperCase();



  const dayStr = String(date.day).padStart(2, '0');

  const monthStr = String(date.month).padStart(2, '0');

  const yearStr = String(date.year).slice(-2);



  return `${dayStr}/${monthStr}/${yearStr} - ${weekday}`;

}



function getWeekdayOrderFromSimpleDate(date: {

  year: number;

  month: number;

  day: number;

}): number {

  const utcDate = new Date(Date.UTC(date.year, date.month - 1, date.day));



  const day = utcDate.getUTCDay();



  return day === 0 ? 7 : day;

}



function normalizeBrandValue(value: string): string {

  return value

    .replace(/\u00A0/g, ' ')

    .trim()

    .replace(/\s+/g, ' ')

    .toLocaleLowerCase('uk-UA');

}



function SalesFilter({

  departments,

  agents,

  department,

  agent,

  dateFrom,

  dateTo,

  onChangeDepartment,

  onChangeAgent,

  onChangeDateFrom,

  onChangeDateTo,

}: {

  departments: string[];

  agents: string[];

  department: string;

  agent: string;

  dateFrom: string;

  dateTo: string;

  onChangeDepartment: (value: string) => void;

  onChangeAgent: (value: string) => void;

  onChangeDateFrom: (value: string) => void;

  onChangeDateTo: (value: string) => void;

}) {

  return (

    <div

      style={{

        display: 'grid',

        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',

        gap: 12,

        marginBottom: 12,

      }}

    >

      <label style={{ display: 'grid', gap: 6 }}>

        <span style={{ fontSize: 12, color: '#cfe1ff' }}>Відділ</span>

        <select

          value={department}

          onChange={e => onChangeDepartment(e.target.value)}

        >

          <option value="">Усі відділи</option>

          {departments.map(item => (

            <option key={item} value={item}>

              {item}

            </option>

          ))}

        </select>

      </label>



      <label style={{ display: 'grid', gap: 6 }}>

        <span style={{ fontSize: 12, color: '#cfe1ff' }}>ТП</span>

        <select value={agent} onChange={e => onChangeAgent(e.target.value)}>

          <option value="">Усі ТП</option>

          {agents.map(item => (

            <option key={item} value={item}>

              {item}

            </option>

          ))}

        </select>

      </label>



      <label style={{ display: 'grid', gap: 6 }}>

        <span style={{ fontSize: 12, color: '#cfe1ff' }}>Дата від</span>

        <input

          type="date"

          value={dateFrom}

          onClick={e => openDatePicker(e.currentTarget)}

          onChange={e => onChangeDateFrom(e.target.value)}

        />

      </label>



      <label style={{ display: 'grid', gap: 6 }}>

        <span style={{ fontSize: 12, color: '#cfe1ff' }}>Дата до</span>

        <input

          type="date"

          value={dateTo}

          onClick={e => openDatePicker(e.currentTarget)}

          onChange={e => onChangeDateTo(e.target.value)}

        />

      </label>

    </div>

  );

}



export default function SalesByDaysPage({ onBack }: { onBack: () => void }) {

  const [agent, setAgent] = useState('');

  const [department, setDepartment] = useState('');

  const [brands, setBrands] = useState<Set<string>>(new Set());

  const [dateFrom, setDateFrom] = useState('');

  const [dateTo, setDateTo] = useState('');



  const {

    data = [],

    isLoading,

    error,

  } = useQuery<SalesByDaysRow[]>({

    queryKey: [

      'sales-by-days',

      department,

      agent,

      dateFrom,

      dateTo,

      [...brands].sort().join(','),

    ],

    queryFn: () =>

      fetchSalesByDays({

        department: department ? [department] : [],

        agent: agent ? [agent] : [],

        brands: [...brands],

        dateFrom,

        dateTo,

      }),

    staleTime: 1000 * 60 * 5,

  });



  const { data: filtersData } = useQuery({

    queryKey: ['sales-by-days-filters', department, agent, dateFrom, dateTo],

    queryFn: () =>

      fetchSalesFilters({

        department: department ? [department] : [],

        agent: agent ? [agent] : [],
        dateFrom,

        dateTo,

      }),

    staleTime: 1000 * 60 * 5,

  });



  const uniqueDepartments = filtersData?.departments ?? [];

  const uniqueAgents = filtersData?.agents ?? [];

  const uniqueBrands = filtersData?.brands ?? [];



  const orimiBrands = useMemo(

    () =>

      uniqueBrands.filter(

        brand => normalizeBrandValue(brand) !== normalizeBrandValue('Деліція')

      ),

    [uniqueBrands]

  );



  const isOrimiBrandsSelected = useMemo(() => {

    if (orimiBrands.length === 0) return false;



    return (

      brands.size === orimiBrands.length &&

      orimiBrands.every(brand => brands.has(brand))

    );

  }, [brands, orimiBrands]);



  const rows = useMemo<DayStats[]>(() => {

    return data

      .map(item => {

        const adjustedDate = parseSimpleDate(item.date);



        const dateSortValue = adjustedDate

          ? new Date(

              adjustedDate.year,

              adjustedDate.month - 1,

              adjustedDate.day

            ).getTime()

          : 0;



        return {

          dateLabel: item.date,



          dateDisplay: adjustedDate

            ? formatDateDisplay(adjustedDate)

            : item.date,



          dateSortValue,



          weekKey: `${item.week_year}-W${String(item.week_number).padStart(

            2,

            '0'

          )}`,



          weekLabel: `Тиждень ${String(item.week_number).padStart(2, '0')}`,



          weekSortValue: item.week_year * 100 + item.week_number,



          weekdayOrder: adjustedDate

            ? getWeekdayOrderFromSimpleDate(adjustedDate)

            : 99,



          amount: Number(item.amount) || 0,

          weight: Number(item.weight) || 0,

          storesCount: Number(item.storesCount) || 0,

          tt500: Number(item.tt500) || 0,

        };

      })

      .sort((a, b) => {

        if (a.weekSortValue !== b.weekSortValue) {

          return b.weekSortValue - a.weekSortValue;

        }



        if (a.weekdayOrder !== b.weekdayOrder) {

          return a.weekdayOrder - b.weekdayOrder;

        }



        return b.dateSortValue - a.dateSortValue;

      });

  }, [data]);

  const format = (n: number) =>

    n.toLocaleString('uk-UA', {

      maximumFractionDigits: 2,

    });



  const weeklyTotals = useMemo(() => {

    const map = new Map<

      string,

      {

        label: string;

        totals: Totals;

      }

    >();



    rows.forEach(row => {

      if (!map.has(row.weekKey)) {

        map.set(row.weekKey, {

          label: row.weekLabel,

          totals: {

            storesCount: 0,

            tt500: 0,

            weight: 0,

            amount: 0,

          },

        });

      }



      const week = map.get(row.weekKey);



      if (!week) return;



      week.totals.storesCount += row.storesCount;

      week.totals.tt500 += row.tt500;

      week.totals.weight += row.weight;

      week.totals.amount += row.amount;

    });



    return map;

  }, [rows]);



  const grandTotal = useMemo<Totals>(() => {

    return rows.reduce(

      (acc, row) => {

        acc.storesCount += row.storesCount;

        acc.tt500 += row.tt500;

        acc.weight += row.weight;

        acc.amount += row.amount;



        return acc;

      },

      {

        storesCount: 0,

        tt500: 0,

        weight: 0,

        amount: 0,

      }

    );

  }, [rows]);

  const dayOfWeekChartRows = useMemo(() => {

    const weekdayLabels = [

      '',

      'Понеділок',

      'Вівторок',

      'Середа',

      'Четвер',

      "П'ятниця",

      'Субота',

      'Неділя',

    ];

    const map = new Map<

      number,

      {

        day: number;

        label: string;

        rows: Array<{

          dateLabel: string;

          dateDisplay: string;

          amount: number;

          storesCount: number;

        }>;

      }

    >();



    rows.forEach(row => {

      const day = row.weekdayOrder;

      if (!map.has(day)) {

        map.set(day, {

          day,

          label: weekdayLabels[day] || `День ${day}`,

          rows: [],

        });

      }



      const dayData = map.get(day);

      if (!dayData) return;



      dayData.rows.push({

        dateLabel: row.dateLabel,

        dateDisplay: row.dateDisplay,

        amount: row.amount,

        storesCount: row.storesCount,

      });

    });



    return Array.from(map.values()).sort((a, b) => a.day - b.day);

  }, [rows]);



  const chartLimits = useMemo(() => {

    return rows.reduce(

      (acc, row) => {

        acc.maxAmountAbs = Math.max(acc.maxAmountAbs, Math.abs(row.amount));



        acc.maxStores = Math.max(acc.maxStores, row.storesCount);



        return acc;

      },

      {

        maxAmountAbs: 0,

        maxStores: 0,

      }

    );

  }, [rows]);



  const weekChartRows = useMemo<WeekChartStats[]>(() => {

    const map = new Map<string, WeekChartStats>();



    rows.forEach(row => {

      if (!map.has(row.weekKey)) {

        map.set(row.weekKey, {

          weekKey: row.weekKey,

          weekLabel: row.weekLabel,

          weekSortValue: row.weekSortValue,

          amount: 0,

          storesCount: 0,

        });

      }



      const week = map.get(row.weekKey);



      if (!week) return;



      week.amount += row.amount;

      week.storesCount += row.storesCount;

    });



    return Array.from(map.values()).sort(

      (a, b) => a.weekSortValue - b.weekSortValue

    );

  }, [rows]);



  const weekChartLimits = useMemo(() => {

    return weekChartRows.reduce(

      (acc, row) => {

        acc.maxAmountAbs = Math.max(acc.maxAmountAbs, Math.abs(row.amount));



        acc.maxStores = Math.max(acc.maxStores, row.storesCount);



        return acc;

      },

      {

        maxAmountAbs: 0,

        maxStores: 0,

      }

    );

  }, [weekChartRows]);



  const getWeekChartPercent = (row: WeekChartStats, metric: ChartMetric) => {

    if (metric === 'amount') {

      if (weekChartLimits.maxAmountAbs === 0) return 0;



      return (Math.abs(row.amount) / weekChartLimits.maxAmountAbs) * 100;

    }



    if (weekChartLimits.maxStores === 0) return 0;



    return (row.storesCount / weekChartLimits.maxStores) * 100;

  };



  const chartMetrics: Array<{

    key: ChartMetric;

    title: string;

  }> = [

    {

      key: 'amount',

      title: 'Сума по днях',

    },

    {

      key: 'stores',

      title: 'ТТ по днях',

    },

  ];



  if (isLoading) return <Loader />;



  if (error) {

    const message =

      error instanceof Error ? error.message : 'Не вдалося завантажити дані';



    return <div className={styles.error}>Помилка: {message}</div>;

  }



  return (

    <div className={styles.container}>

      <SalesFilter

        departments={uniqueDepartments}

        agents={uniqueAgents}

        department={department}

        agent={agent}

        dateFrom={dateFrom}

        dateTo={dateTo}

        onChangeDepartment={setDepartment}

        onChangeAgent={setAgent}

        onChangeDateFrom={setDateFrom}

        onChangeDateTo={setDateTo}

      />



      <div className={styles.brandFilters}>

        <button

          className={`${styles.brandButton} ${

            brands.size === 0 ? styles.brandButtonActive : ''

          }`}

          onClick={() => setBrands(new Set())}

        >

          Усі ТМ

        </button>



        <button

          className={`${styles.brandButton} ${

            isOrimiBrandsSelected ? styles.brandButtonActive : ''

          }`}

          onClick={() => setBrands(new Set(orimiBrands))}

        >

          Усі ТМ Orimi

        </button>



        {uniqueBrands.map(tm => (

          <button

            key={tm}

            className={`${styles.brandButton} ${

              brands.has(tm) ? styles.brandButtonActive : ''

            }`}

            onClick={() => {

              const newBrands = new Set(brands);

              if (newBrands.has(tm)) {

                newBrands.delete(tm);

              } else {

                newBrands.add(tm);

              }

              setBrands(newBrands);

            }}

          >

            {tm}

          </button>

        ))}

      </div>



      <section className={styles.section}>

        <h3 className={styles.title}>Продажі по днях</h3>



        <div className={styles.tableWrap}>

          <table className={styles.table}>

            <thead>

              <tr>

                <th>Дата</th>

                <th>ТТ</th>

                <th>ТТ 500+</th>

                <th>Вага</th>

                <th>Сума</th>

              </tr>

            </thead>



            <tbody>

              <tr className={styles.grandTotalRow}>

                <td>

                  <b>Загалом</b>

                </td>



                <td>

                  <b>{grandTotal.storesCount}</b>

                </td>



                <td>

                  <b>{grandTotal.tt500}</b>

                </td>



                <td>

                  <b>{format(grandTotal.weight)}</b>

                </td>



                <td>

                  <b>{format(grandTotal.amount)}</b>

                </td>

              </tr>



              {rows.map((row, index) => {

                const nextRow = rows[index + 1];



                const isWeekEnd = !nextRow || nextRow.weekKey !== row.weekKey;



                const weekData = weeklyTotals.get(row.weekKey);



                return (

                  <Fragment key={row.dateLabel}>

                    <tr>

                      <td>{row.dateDisplay}</td>



                      <td>{row.storesCount}</td>



                      <td>{row.tt500}</td>



                      <td>{format(row.weight)}</td>



                      <td>{format(row.amount)}</td>

                    </tr>



                    {isWeekEnd && weekData && (

                      <tr className={styles.weekTotalRow}>

                        <td>

                          <b>Разом за {weekData.label}</b>

                        </td>



                        <td>

                          <b>{weekData.totals.storesCount}</b>

                        </td>



                        <td>

                          <b>{weekData.totals.tt500}</b>

                        </td>



                        <td>

                          <b>{format(weekData.totals.weight)}</b>

                        </td>



                        <td>

                          <b>{format(weekData.totals.amount)}</b>

                        </td>

                      </tr>

                    )}

                  </Fragment>

                );

              })}

            </tbody>

          </table>

        </div>

      </section>



      <section className={styles.chartsSection}>

        <div className={styles.chartsGrid}>

          {chartMetrics.map(metric => (

            <article key={`day-${metric.key}`} className={styles.chartCard}>

              <h4 className={styles.chartTitle}>{metric.title}</h4>

              <div className={styles.chartBody}>

                {dayOfWeekChartRows.map(dayOfWeek => (

                  <div key={`day-group-${metric.key}-${dayOfWeek.day}`}>

                    <div

                      style={{

                        fontWeight: 600,

                        fontSize: '13px',

                        color: '#9fd1ff',

                        marginTop: '8px',

                        marginBottom: '4px',

                        paddingLeft: '4px',

                        borderLeft: '3px solid rgba(116, 174, 255, 0.9)',

                      }}

                    >

                      {dayOfWeek.label}

                    </div>

                    {dayOfWeek.rows.map(dateRow => {

                      const width =

                        metric.key === 'amount'

                          ? chartLimits.maxAmountAbs === 0

                            ? 0

                            : (Math.abs(dateRow.amount) /

                                chartLimits.maxAmountAbs) *

                              100

                          : chartLimits.maxStores === 0

                            ? 0

                            : (dateRow.storesCount / chartLimits.maxStores) *

                              100;



                      const value =

                        metric.key === 'amount'

                          ? format(dateRow.amount)

                          : dateRow.storesCount.toLocaleString('uk-UA');



                      return (

                        <div

                          key={`${metric.key}-${dateRow.dateLabel}`}

                          className={styles.chartRow}

                        >

                          <div className={styles.chartDate}>

                            {dateRow.dateDisplay.slice(0, 8)}

                          </div>

                          <div className={styles.chartTrack}>

                            <div

                              className={`${styles.chartBar} ${

                                metric.key === 'amount' && dateRow.amount < 0

                                  ? styles.chartBarNegative

                                  : ''

                              }`}

                              style={{ width: `${width}%` }}

                            />

                          </div>

                          <div className={styles.chartValue}>{value}</div>

                        </div>

                      );

                    })}

                  </div>

                ))}

              </div>

            </article>

          ))}



          {chartMetrics.map(metric => (

            <article key={`week-${metric.key}`} className={styles.chartCard}>

              <h4 className={styles.chartTitle}>

                {metric.key === 'amount' ? 'Сума по тижнях' : 'ТТ по тижнях'}

              </h4>

              <div className={styles.chartBody}>

                {weekChartRows.map(row => {

                  const width = getWeekChartPercent(row, metric.key);

                  const value =

                    metric.key === 'amount'

                      ? format(row.amount)

                      : row.storesCount.toLocaleString('uk-UA');



                  return (

                    <div

                      key={`${metric.key}-${row.weekKey}`}

                      className={styles.chartRow}

                    >

                      <div className={styles.chartDate}>{row.weekLabel}</div>

                      <div className={styles.chartTrack}>

                        <div

                          className={`${styles.chartBar} ${

                            metric.key === 'amount' && row.amount < 0

                              ? styles.chartBarNegative

                              : ''

                          }`}

                          style={{ width: `${width}%` }}

                        />

                      </div>

                      <div className={styles.chartValue}>{value}</div>

                    </div>

                  );

                })}

              </div>

            </article>

          ))}

        </div>

      </section>



      <button onClick={onBack} className={styles.backButton}>

        ← Назад

      </button>

    </div>

  );

}

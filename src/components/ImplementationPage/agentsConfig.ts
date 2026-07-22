export const DEPARTMENT_ORDER: {
  dept: string;
  label: string;
  agents: string[];
}[] = [
  {
    dept: 'Місто+Область (Центр)',
    label: 'Місто+Область (Центр)',
    agents: [
      'Гриник Ольга',
      'Довга Діана',
      'Лаптєва Руслана',
      'Могильна Оксана',
      'Сторожук Аліна',
      'Ящишина Наталія',
    ],
  },
  {
    dept: 'Шепетівський відділ',
    label: 'Шепетівський відділ',
    agents: [
      'Кучер Аня',
      'Мартинчик Альона',
      'Нагорняк Світлана',
      'Швець Ірина',
    ],
  },
  {
    dept: "Кам'янець-Подільський відділ",
    label: "Кам'янець-Подільський відділ",
    agents: ['Дюг Тетяна', 'Івасишин Денис', 'Олійник Влад'],
  },
];

export const ALL_AGENTS = DEPARTMENT_ORDER.flatMap(d => d.agents);

export const ORIMI_BRANDS = [
  'Greenfield',
  'TESS',
  'Принцеса Нурі',
  'Принцеса Канді',
  'Принцеса Ява',
  'Принцеса Гіта',
  'Жокей',
  'JARDIN',
  'PIAZZA',
];

const ORIMI_SET = new Set(ORIMI_BRANDS.map(b => b.toLowerCase().trim()));
const PRINCESSA_PREFIXES = ['принцеса'];

export type BrandFilter =
  | 'all_orimi'
  | 'jockey'
  | 'greenfield'
  | 'tess'
  | 'jardin'
  | 'piazza'
  | 'princessa_nuri'
  | 'princessa_kandi'
  | 'princessa_yava'
  | 'princessa_gita'
  | 'princessa'
  | 'delicia'
  | 'all';

export function getBrandLabel(filter: BrandFilter): string {
  switch (filter) {
    case 'all_orimi':
      return 'Всі Orimi';
    case 'jockey':
      return 'Жокей';
    case 'greenfield':
      return 'Greenfield';
    case 'tess':
      return 'TESS';
    case 'jardin':
      return 'JARDIN';
    case 'piazza':
      return 'PIAZZA';
    case 'princessa_nuri':
      return 'Принцеса Нурі';
    case 'princessa_kandi':
      return 'Принцеса Канді';
    case 'princessa_yava':
      return 'Принцеса Ява';
    case 'princessa_gita':
      return 'Принцеса Гіта';
    case 'princessa':
      return 'Принцеса';
    case 'delicia':
      return 'Деліція';
    case 'all':
      return 'Всі бренди';
  }
}

export function matchesBrand(rawBrand: string, filter: BrandFilter): boolean {
  const b = rawBrand
    .replace(/\u00A0/g, ' ')
    .trim()
    .toLocaleLowerCase('uk-UA');

  switch (filter) {
    case 'all':
      return true;
    case 'all_orimi':
      return ORIMI_SET.has(b);
    case 'jockey':
      return b === 'жокей';
    case 'greenfield':
      return b === 'greenfield';
    case 'tess':
      return b === 'tess';
    case 'jardin':
      return b === 'jardin';
    case 'piazza':
      return b.startsWith('piazza');
    case 'princessa_nuri':
      return b === 'принцеса нурі';
    case 'princessa_kandi':
      return b === 'принцеса канді';
    case 'princessa_yava':
      return b === 'принцеса ява';
    case 'princessa_gita':
      return b === 'принцеса гіта';
    case 'princessa':
      return PRINCESSA_PREFIXES.some(p => b.startsWith(p));
    case 'delicia':
      return b === 'деліція';
  }
}

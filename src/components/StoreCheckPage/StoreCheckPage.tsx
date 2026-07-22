import { useState, type FormEvent } from 'react';
import { useSaveStoreCheckMutation } from '../../hooks/api/useReportMutations';
import Loader from '../Loader/Loader';
import StoreSelector from '../StoreSelector/StoreSelector';
import StoreCheckPhotoUpload from './StoreCheckPhotoUpload';
import { storeCheckPhotoDB } from './storeCheckPhotoDB';
import styles from './StoreCheckPage.module.css';

const NUMERIC_SECTIONS = [
  {
    title: 'Чай',
    fields: [
      { key: 'princessa', label: 'Принцеса' },
      { key: 'greenfield', label: 'Greenfield' },
      { key: 'tess', label: 'Tess' },
    ],
  },
  {
    title: 'Кава',
    fields: [
      { key: 'jockey', label: 'Жокей' },
      { key: 'jardin', label: 'Jardin' },
      { key: 'piazza', label: 'Piazza del Caffe' },
    ],
  },
  {
    title: 'Strauss',
    fields: [
      { key: 'eliteFort', label: 'Elite Fort' },
      { key: 'blackCard', label: 'Чорна Карта' },
      { key: 'ambassador', label: 'Ambassador' },
      { key: 'drinks', label: 'Цикорій+напої' },
    ],
  },
  {
    title: 'Вода',
    fields: [
      { key: 'bonBoisson', label: 'Bon Boisson' },
      { key: 'chudoSad', label: 'Чудо Сад' },
    ],
  },

  {
    title: 'Delicia / Інше',
    fields: [
      { key: 'flex_delicia', label: 'Flex Delicia' },
      { key: 'flex_other', label: 'Flex Інше' },
      { key: 'tubus_delicia', label: 'Тубус Delicia' },
      { key: 'tubus_other', label: 'Тубус Інше' },
      { key: 'small_delicia', label: '0,25-0,45 кг Delicia' },
      { key: 'small_other', label: '0,25-0,45 кг Інше' },
      { key: 'weight_delicia', label: 'Вагове Delicia' },
      { key: 'weight_other', label: 'Вагове Інше' },
    ],
  },
  {
    title: 'Вагове печиво',
    fields: [
      { key: 'domashne', label: 'Домашнє' },
      { key: 'malvina', label: 'Мальвіна' },
      { key: 'do_chayu', label: 'До чаю, Джулія, Пряжене' },
      { key: 'djulia_kakao', label: 'Джулія какао' },
    ],
  },
  {
    title: 'Вагове печиво з наповнювачем і глазуроване',
    fields: [
      { key: 'superMonika', label: 'Супер Моніка' },
      { key: 'yagidka', label: 'Желейна ягідка, Райські яблучка' },
      { key: 'delicia', label: 'Деліція' },
      { key: 'artemon', label: 'Артемон' },
      { key: 'margaritka', label: 'Маргаритка' },
      { key: 'yin_yan', label: 'Інь-Янь/Райські яблучка шоколад' },
    ],
  },
  {
    title: 'Вагова прянична група',
    fields: [
      { key: 'vorzelsky', label: 'Ворзельский' },
      { key: 'bavarianChocolate', label: 'Баварський в шоколаді' },
      { key: 'bears', label: 'Ведмедики' },
      { key: 'maminPryanik', label: 'Мамин пряник' },
    ],
  },
  {
    title: 'Вафельна група вагова',
    fields: [
      { key: 'waffleTube', label: 'Трубочка' },
      { key: 'ritm_artek', label: 'Ритм, Артек' },
    ],
  },
  {
    title: 'Ваговий додатковий асортимент',
    fields: [
      { key: 'vivsyane', label: 'Вівсяне, Кукурудзяне' },
      { key: 'alpiyske_fitnes', label: 'Альпійське, Фітнес' },
      { key: 'superStarBG', label: 'Супер Стар BG' },
      { key: 'other_snacks', label: 'Інше печиво' },
      { key: 'other_pryanik', label: 'Інше пряник' },
    ],
  },
] as const;

type NumericFieldKey =
  (typeof NUMERIC_SECTIONS)[number]['fields'][number]['key'];
type NumericFormState = Record<NumericFieldKey, string>;

const ALL_NUMERIC_KEYS = NUMERIC_SECTIONS.flatMap(section =>
  section.fields.map(field => field.key)
) as NumericFieldKey[];

const EMPTY_NUMBERS: NumericFormState = Object.fromEntries(
  ALL_NUMERIC_KEYS.map(k => [k, ''])
) as NumericFormState;

function toNumber(value: string): number {
  if (!value.trim()) return 0;

  const normalized = value.replace(',', '.');
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
}

function sumValues(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

type SelectedStore = {
  department: string;
  representative: string;
  store: string;
};

type Props = {
  onBack: () => void;
};

export default function StoreCheckPage({ onBack }: Props) {
  const [selectedStore, setSelectedStore] = useState<SelectedStore | null>(
    null
  );

  if (!selectedStore) {
    return (
      <StoreSelector
        source="sales"
        onSelect={setSelectedStore}
        onBack={onBack}
      />
    );
  }

  return (
    <StoreCheckForm
      department={selectedStore.department}
      representative={selectedStore.representative}
      ttName={selectedStore.store}
      onChangeStore={() => setSelectedStore(null)}
    />
  );
}

type FormProps = {
  department: string;
  representative: string;
  ttName: string;
  onChangeStore: () => void;
};

function StoreCheckForm({
  department,
  representative,
  ttName,
  onChangeStore,
}: FormProps) {
  const [date] = useState(() => {
    const kyivDate = new Date().toLocaleString('en-CA', {
      timeZone: 'Europe/Kyiv',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return kyivDate;
  });

  const [territory, setTerritory] = useState('');
  const [categoryOrimi, setCategoryOrimi] = useState('');
  const [categoryDelicia, setCategoryDelicia] = useState('');
  const [commentOrimi, setCommentOrimi] = useState('');
  const [commentDelicia, setCommentDelicia] = useState('');
  const [numbers, setNumbers] = useState<NumericFormState>(EMPTY_NUMBERS);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error' | null>(
    null
  );

  const saveMutation = useSaveStoreCheckMutation();

  const teaTotal = sumValues([
    toNumber(numbers.princessa),
    toNumber(numbers.greenfield),
    toNumber(numbers.tess),
  ]);
  const coffeeTotal = sumValues([
    toNumber(numbers.jockey),
    toNumber(numbers.jardin),
    toNumber(numbers.piazza),
  ]);
  const straussTotal = sumValues([
    toNumber(numbers.eliteFort),
    toNumber(numbers.blackCard),
    toNumber(numbers.ambassador),
    toNumber(numbers.drinks),
  ]);
  const waterTotal = sumValues([
    toNumber(numbers.bonBoisson),
    toNumber(numbers.chudoSad),
  ]);
  const deliciaTotal = sumValues([
    toNumber(numbers.flex_delicia),
    toNumber(numbers.tubus_delicia),
    toNumber(numbers.small_delicia),
    toNumber(numbers.weight_delicia),
  ]);
  const otherTotal = sumValues([
    toNumber(numbers.flex_other),
    toNumber(numbers.tubus_other),
    toNumber(numbers.small_other),
    toNumber(numbers.weight_other),
  ]);

  function handleNumericChange(key: NumericFieldKey, value: string) {
    if (value !== '' && !/^\d*([.,]\d{0,2})?$/.test(value)) {
      return;
    }

    setNumbers(prev => ({
      ...prev,
      [key]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setMessageType(null);

    try {
      const result = await saveMutation.mutateAsync({
        date,
        ttName: ttName.trim(),
        department,
        representative,

        princessa: toNumber(numbers.princessa),
        greenfield: toNumber(numbers.greenfield),
        tess: toNumber(numbers.tess),
        tea_total: teaTotal,
        jockey: toNumber(numbers.jockey),
        jardin: toNumber(numbers.jardin),
        piazza: toNumber(numbers.piazza),
        coffee_total: coffeeTotal,
        eliteFort: toNumber(numbers.eliteFort),
        blackCard: toNumber(numbers.blackCard),
        ambassador: toNumber(numbers.ambassador),
        strauss_total: straussTotal,
        bonBoisson: toNumber(numbers.bonBoisson),
        chudoSad: toNumber(numbers.chudoSad),
        water_total: waterTotal,
        fas_delicia: toNumber(numbers.flex_delicia),
        fas_other: toNumber(numbers.flex_other),
        tubus_delicia: toNumber(numbers.tubus_delicia),
        tubus_other: toNumber(numbers.tubus_other),
        small_delicia: toNumber(numbers.small_delicia),
        small_other: toNumber(numbers.small_other),
        weight_delicia: toNumber(numbers.weight_delicia),
        weight_other: toNumber(numbers.weight_other),
        delicia_total: deliciaTotal,
        other_total: otherTotal,
        domashne: toNumber(numbers.domashne),
        malyuk: toNumber(numbers.malvina),
        pryazhene: toNumber(numbers.do_chayu),
        kakao: toNumber(numbers.djulia_kakao),
        superMonika: toNumber(numbers.superMonika),
        riagel: toNumber(numbers.yagidka),
        artek: toNumber(numbers.artemon),
        bisquit: toNumber(numbers.margaritka),
        fitness: toNumber(numbers.yin_yan),
        bg: toNumber(numbers.superStarBG),
        other_snacks_cookie: toNumber(numbers.other_snacks),
        other_snacks_pryanik: toNumber(numbers.other_pryanik),
        other_snacks: sumValues([
          toNumber(numbers.other_snacks),
          toNumber(numbers.other_pryanik),
        ]),
        categoryOrimi: categoryOrimi || undefined,
        categoryDelicia: categoryDelicia || undefined,
        comment: commentOrimi.trim() || undefined,
        commentDelicia: commentDelicia.trim() || undefined,
      });

      if (!result.success) {
        setMessage(result.error || 'Не вдалося зберегти StoreCheck.');
        setMessageType('error');
        return;
      }

      setMessage(
        result.result?.id
          ? `StoreCheck збережено. ID: ${result.result.id}`
          : 'StoreCheck успішно збережено.'
      );
      setMessageType('success');

      await storeCheckPhotoDB.photos
        .where('ttName')
        .equals(ttName)
        .and(
          photo =>
            photo.department === department &&
            photo.representative === representative
        )
        .delete();

      window.setTimeout(() => {
        onChangeStore();
      }, 600);
    } catch {
      setMessage('Помилка збереження StoreCheck. Спробуйте ще раз.');
      setMessageType('error');
    }
  }

  return (
    <div className={styles.container}>
      {saveMutation.isPending && <Loader />}

      <header className={styles.header}>
        <h2 className={styles.title}>{ttName}</h2>
        <p className={styles.subtitle}>
          {department} • {representative}
        </p>
      </header>

      <form className={styles.form} onSubmit={handleSubmit}>
        <section className={`${styles.contentCard} ${styles.heroCard}`}>
          <div className={styles.metaGrid}>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Дата</span>
              <span className={styles.metaValue}>{date}</span>
            </div>

            <label className={styles.metaItem}>
              <span className={styles.metaLabel}>Територія</span>
              <input
                className={styles.inputTerritory}
                type="text"
                value={territory}
                onChange={e => setTerritory(e.target.value)}
                placeholder="напрямок, район, місто"
              />
            </label>
          </div>
        </section>

        <div className={styles.filtersGrid}>
          <section className={styles.contentCard}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>Категорія Orimi</h3>
            </div>

            <select
              value={categoryOrimi}
              onChange={e => setCategoryOrimi(e.target.value)}
              className={styles.select}
            >
              <option value="" disabled hidden>
                Категорія Orimi
              </option>

              <option value="1">1 категорія (1–6 м.)</option>
              <option value="2">2 категорія (6–9 м.)</option>
              <option value="3">3 категорія (9–15 м.)</option>
              <option value="4">4 категорія (15–30 м.)</option>
              <option value="5">5 категорія (30+ м.)</option>
            </select>
          </section>

          <section className={styles.contentCard}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>Категорія Delicia</h3>
            </div>

            <select
              value={categoryDelicia}
              onChange={e => setCategoryDelicia(e.target.value)}
              className={styles.select}
            >
              <option value="" disabled hidden>
                Категорія Delicia
              </option>

              <option value="СМ">Категорія (Супер Маркет)</option>
              <option value="А">Категорія А (площа до 200 м2)</option>
              <option value="В">Категорія В (площа 50-150 м2)</option>
              <option value="С">Категорія С ( площа до 50 м2)</option>
              <option value="СП">Спецроздріб</option>
              <option value="Г">Гурт</option>
              <option value="НК">Нетрадиційний канал</option>
            </select>
          </section>
        </div>

        {NUMERIC_SECTIONS.map(section => (
          <section key={section.title} className={styles.contentCard}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.cardTitle}>{section.title}</h3>
              {section.title === 'Чай' && (
                <div className={styles.sectionTotal}>Разом: {teaTotal}</div>
              )}

              {section.title === 'Кава' && (
                <div className={styles.sectionTotal}>Разом: {coffeeTotal}</div>
              )}

              {section.title === 'Strauss' && (
                <div className={styles.sectionTotal}>Разом: {straussTotal}</div>
              )}

              {section.title === 'Вода' && (
                <div className={styles.sectionTotal}>Разом: {waterTotal}</div>
              )}
            </div>

            <div className={styles.numericGrid}>
              {section.fields.map(field => (
                <label key={field.key} className={styles.field}>
                  <span className={styles.label}>{field.label}</span>
                  <input
                    className={styles.input}
                    type="text"
                    inputMode="decimal"
                    value={numbers[field.key]}
                    onChange={event =>
                      handleNumericChange(field.key, event.target.value)
                    }
                  />
                </label>
              ))}
            </div>

            {section.title === 'Delicia / Інше' && (
              <div className={styles.totalsSplit}>
                <div className={styles.totalRow}>Delicia: {deliciaTotal}</div>
                <div className={styles.totalRow}>Інше: {otherTotal}</div>
              </div>
            )}
          </section>
        ))}

        <section className={styles.contentCard}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>Коментар</h3>
          </div>

          <label className={`${styles.field} ${styles.fieldBlock}`}>
            <textarea
              className={styles.textarea}
              value={commentOrimi}
              onChange={event => setCommentOrimi(event.target.value)}
              placeholder="Коментар по точці, щодо чайно-ковової групи, води"
            />
          </label>
        </section>

        <section className={styles.contentCard}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>Коментар для Delicia</h3>
          </div>

          <label className={`${styles.field} ${styles.fieldBlock}`}>
            <textarea
              className={styles.textarea}
              value={commentDelicia}
              onChange={event => setCommentDelicia(event.target.value)}
              placeholder="Коментар для store-check Delicia"
            />
          </label>
        </section>

        <section className={styles.contentCard}>
          <StoreCheckPhotoUpload
            ttName={ttName}
            department={department}
            representative={representative}
            date={date}
          />

          {message && (
            <div
              className={
                messageType === 'success'
                  ? styles.successMessage
                  : styles.errorMessage
              }
            >
              {message}
            </div>
          )}
        </section>

        <div className={styles.actions}>
          <button
            type="submit"
            className={styles.submitButton}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? 'Збереження...' : 'ЗБЕРЕГТИ'}
          </button>
        </div>
      </form>

      <button onClick={onChangeStore} className={styles.backButton}>
        ← Назад
      </button>
    </div>
  );
}

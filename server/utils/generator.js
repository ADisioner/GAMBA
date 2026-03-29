const FIRST_NAMES = ['Иван', 'Сергей', 'Алексей', 'Дмитрий', 'Артем', 'Максим', 'Николай', 'Виктор', 'Станислав', 'Джон', 'Марк', 'Эрик', 'Карл', 'Ахмед', 'Саид'];
const LAST_NAMES = ['Иванов', 'Петров', 'Сидоров', 'Волков', 'Смирнов', 'Кузнецов', 'Попов', 'Смит', 'Миллер', 'Герберт', 'Али', 'Мансур'];
const CALLSIGNS = ['Призрак', 'Тень', 'Волк', 'Медведь', 'Сокол', 'Стриж', 'Титан', 'Гранит', 'Витязь', 'Скат', 'Хаос', 'Гром', 'Морж', 'Зеро', 'Кобра'];
const NATIONALITIES = ['RU', 'US', 'UK', 'DE', 'FR', 'CN', 'BR', 'ZA', 'UA', 'KZ'];

const CONTRACT_TYPES = [
  { title: 'Охрана объекта', desc: 'Требуется защита промышленного комплекса от местных банд.' },
  { title: 'Конвой', desc: 'Сопровождение гуманитарного груза через опасную зону.' },
  { title: 'Штурм', desc: 'Зачистка укрепленного района повстанцев.' },
  { title: 'Эвакуация', desc: 'Спасение гражданских специалистов из зоны конфликта.' },
  { title: 'Саботаж', desc: 'Уничтожение склада боеприпасов противника.' },
  { title: 'Разведка', desc: 'Сбор данных о перемещении сил боевиков.' }
];

const REGIONS = [
  { id: 'middle_east', name: 'Ближний Восток', risk: 1.5, mult: 1.4 },
  { id: 'africa', name: 'Африка', risk: 1.8, mult: 1.6 },
  { id: 'europe', name: 'Восточная Европа', risk: 1.2, mult: 1.1 },
  { id: 'asia', name: 'Юго-Восточная Азия', risk: 1.4, mult: 1.3 },
  { id: 'latam', name: 'Латинская Америка', risk: 1.6, mult: 1.5 }
];

const DIFFICULTIES = {
  easy: { mult: 1, minStat: 10 },
  medium: { mult: 2.5, minStat: 30 },
  hard: { mult: 6, minStat: 50 },
  suicide: { mult: 15, minStat: 80 }
};

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateSoldier() {
  const name = FIRST_NAMES[randomInt(0, FIRST_NAMES.length - 1)] + ' ' + LAST_NAMES[randomInt(0, LAST_NAMES.length - 1)];
  const callsign = CALLSIGNS[randomInt(0, CALLSIGNS.length - 1)];
  const age = randomInt(20, 45);
  const nationality = NATIONALITIES[randomInt(0, NATIONALITIES.length - 1)];
  
  // Базоввые статы
  const shooting = randomInt(5, 40);
  const melee = randomInt(5, 40);
  const tactics = randomInt(5, 40);
  const medical = randomInt(5, 40);
  const engineering = randomInt(5, 40);
  
  // Зарплата зависит от суммарных статов
  const totalStats = shooting + melee + tactics + medical + engineering;
  const salary = 500 + totalStats * 20;

  return {
    name,
    callsign,
    age,
    nationality,
    portrait: `soldier_${randomInt(1, 20)}.jpg`,
    shooting,
    melee,
    tactics,
    medical,
    engineering,
    salary,
    contractEnds: 12, // по умолчанию 12 недель
    health: 100,
    energy: 100,
    morale: 100,
    status: 'ready'
  };
}

function generateContract(type = 'personal', difficulty = 'easy', activeEvents = []) {
  const baseType = CONTRACT_TYPES[randomInt(0, CONTRACT_TYPES.length - 1)];
  const region = REGIONS[randomInt(0, REGIONS.length - 1)];
  const diff = DIFFICULTIES[difficulty] || DIFFICULTIES.easy;
  
  // Применяем модификаторы от событий
  let eventMult = 1;
  activeEvents.forEach(e => {
    if (e.regionId === region.id) eventMult *= e.rewardMult;
  });

  const baseReward = 5000;
  const reward = Math.floor(baseReward * diff.mult * region.mult * eventMult * (0.8 + Math.random() * 0.4));

  return {
    title: `${baseType.title}: ${region.name}`,
    description: baseType.desc,
    region: region.id,
    difficulty,
    reward,
    type,
    status: 'available',
    eventId: activeEvents.find(e => e.regionId === region.id)?.id || null
  };
}

module.exports = { generateSoldier, generateContract };

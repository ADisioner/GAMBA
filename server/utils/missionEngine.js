const DIFFICULTY_POWER = {
  easy: 50,
  medium: 150,
  hard: 400,
  suicide: 1000
};

/**
 * Расчет результата миссии
 * @param {Array} soldiers - список объектов бойцов
 * @param {Object} contract - объект контракта
 * @returns {Object} результат миссии
 */
function simulateMission(soldiers, contract, medBayLevel = 1) {
  const targetPower = DIFFICULTY_POWER[contract.difficulty] || 50;
  
  // Рассчитываем суммарную мощь отряда
  // Веса: стрельба (0.4), тактика (0.3), медицина (0.1), инженерия (0.1), ближний бой (0.1)
  const squadPower = soldiers.reduce((acc, s) => {
    const power = (s.shooting * 0.4) + (s.tactics * 0.3) + (s.medical * 0.1) + (s.engineering * 0.1) + (s.melee * 0.1);
    const moraleMult = 0.5 + (s.morale / 100) * 0.5; // Мораль влияет на эффективность (до -50%)
    return acc + (power * moraleMult);
  }, 0);

  const successChance = Math.min(0.95, Math.max(0.1, squadPower / targetPower));
  const isSuccess = Math.random() < successChance;
  
  const reportLines = [];
  reportLines.push(`Операция "${contract.title}" (Сложность: ${contract.difficulty}).`);
  reportLines.push(`Ожидаемая эффективность отряда: ${Math.floor(successChance * 100)}%.`);

  if (isSuccess) {
    reportLines.push('ИТОГ: Миссия выполнена успешно. Цели достигнуты.');
  } else {
    reportLines.push('ИТОГ: ПРОВАЛ. Группа была вынуждена отступить.');
  }

  // Расчет потерь и опыта
  const squadUpdates = soldiers.map(s => {
    let status = 'ready';
    let healthChange = 0;
    
    // Вероятность получить урон (выше при провале или высокой сложности)
    const woundChance = isSuccess ? 0.15 : 0.4;
    const difficultyMult = { easy: 1, medium: 1.5, hard: 2.5, suicide: 5 }[contract.difficulty];

    if (Math.random() < (woundChance * difficultyMult / 2)) {
      const damage = Math.floor(Math.random() * 40 * difficultyMult);
      healthChange = -damage;
      
      if (s.health + healthChange <= 0) {
        // Проверка на спасение медиком
        const squadMedics = soldiers.reduce((acc, med) => acc + med.medical, 0);
        const saveChance = squadMedics / 200; // 200 медицины в отряде = 100% шанс спасти (статус hospital)
        
        const medBaySaveChance = (medBayLevel - 1) * 0.15; // +15% за каждый уровень выше первого
        
        if (Math.random() < saveChance || Math.random() < medBaySaveChance) {
          status = 'hospital';
          reportLines.push(`Критическое ранение: ${s.callsign} спасен ${Math.random() < saveChance ? 'медиками отряда' : 'персоналом базы'} и эвакуирован в госпиталь.`);
        } else {
          status = 'dead';
          reportLines.push(`ПОТЕРЯ: ${s.callsign} погиб в бою.`);
        }
      } else {
        reportLines.push(`Ранен: ${s.callsign} получил легкие ранения.`);
      }
    }

    // Прокачка статов
    return {
      id: s.id,
      healthChange,
      status,
      xpGain: isSuccess ? randomInt(2, 5) : 1
    };
  });

  return {
    isSuccess,
    report: reportLines.join('\n'),
    profit: isSuccess ? contract.reward : 0,
    squadUpdates
  };
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = { simulateMission };

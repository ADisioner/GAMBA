const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { generateSoldier, generateContract } = require('./utils/generator');
const { simulateMission } = require('./utils/missionEngine');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// --- ИНИЦИАЛИЗАЦИЯ FIREBASE ---
try {
  const serviceAccount = require('./serviceAccountKey.json');
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
} catch (e) {
  console.error('КРИТИЧЕСКАЯ ОШИБКА: Файл serviceAccountKey.json не найден.');
}

const db = admin.firestore();

// --- CORS & LOGGING ---
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use(express.json());

// --- МИДДЛВАР ---
const authenticateToken = async (req, res, next) => {
  if (req.method === 'OPTIONS') return next();

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Auth missing' });

  try {
    const nickname = decodeURIComponent(token);
    const userSnap = await db.collection('users').doc(nickname).get();
    if (!userSnap.exists) return res.status(404).json({ error: 'User not found' });
    
    req.user = { nickname, ...userSnap.data() };
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid auth' });
  }
};

// --- РОУТЫ ---

app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    if (user.pmc_dollars === undefined) {
        await db.collection('users').doc(user.nickname).update({
            pmc_dollars: 50000,
            pmc_goldBars: 10,
            pmc_reputation: 0,
            pmc_currentWeek: 1,
            pmc_baseModules: [
              { type: 'barracks', level: 1 },
              { type: 'medical', level: 1 },
              { type: 'training', level: 1 }
            ]
        });
        user.pmc_dollars = 50000;
        user.pmc_goldBars = 10;
        user.pmc_reputation = 0;
        user.pmc_currentWeek = 1;
        user.pmc_baseModules = [{ type: 'barracks', level: 1 }, { type: 'medical', level: 1 }, { type: 'training', level: 1 }];
    }

    const soldiersSnap = await db.collection('pmc_soldiers').where('ownerNickname', '==', user.nickname).get();
    const soldiers = soldiersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    res.json({ 
      id: user.nickname, 
      nickname: user.nickname,
      pmc_callsign: user.pmc_callsign || null,
      dollars: user.pmc_dollars,
      goldBars: user.pmc_goldBars,
      reputation: user.pmc_reputation,
      currentWeek: user.pmc_currentWeek,
      baseModules: user.pmc_baseModules || [],
      soldiers 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/onboarding', authenticateToken, async (req, res) => {
    const { callsign } = req.body;
    await db.collection('users').doc(req.user.nickname).update({ pmc_callsign: callsign });
    res.json({ success: true, callsign });
});

app.get('/api/market/recruits', authenticateToken, async (req, res) => {
  res.json(Array.from({ length: 5 }, () => generateSoldier()));
});

app.get('/api/market/contracts', authenticateToken, async (req, res) => {
  const missionsSnap = await db.collection('pmc_missions')
    .where('ownerNickname', '==', req.user.nickname)
    .where('status', '==', 'available').get();
  
  let contracts = missionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  if (contracts.length < 3) {
    for (let i = 0; i < 2; i++) {
        const c = generateContract('personal', i === 0 ? 'easy' : 'medium', []);
        const created = await db.collection('pmc_missions').add({ ...c, ownerNickname: req.user.nickname, status: 'available' });
        contracts.push({ id: created.id, ...c });
    }
  }
  res.json(contracts);
});

app.get('/api/market/global', authenticateToken, async (req, res) => {
  const snap = await db.collection('pmc_missions').where('type', '==', 'global').where('status', '==', 'available').get();
  let global = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  if (global.length === 0) {
    const c = generateContract('global', 'hard', []);
    const created = await db.collection('pmc_missions').add({ ...c, type: 'global', status: 'available' });
    global.push({ id: created.id, ...c });
  }
  res.json(global);
});

app.get('/api/leaderboard', async (req, res) => {
  const snap = await db.collection('users').where('pmc_reputation', '>', -1).orderBy('pmc_reputation', 'desc').limit(10).get();
  res.json(snap.docs.map(doc => ({
    nickname: doc.data().nickname,
    pmcName: doc.data().pmc_callsign || 'НЕТ ПОЗЫВНОГО',
    reputation: doc.data().pmc_reputation || 0,
    dollars: doc.data().pmc_dollars || 0
  })));
});

app.get('/api/market/events', async (req, res) => {
  res.json([{ id: 'ev1', title: 'ОПЕРАЦИЯ: ПЕСЧАНАЯ БУРЯ', regionId: 'africa', rewardMult: 1.2, desc: 'Бонус +20% в Африке' }]);
});

app.post('/api/pmc/hire', authenticateToken, async (req, res) => {
  const soldier = req.body;
  if (req.user.pmc_dollars < soldier.salary) return res.status(400).json({ error: 'Недостаточно денег' });
  
  await db.collection('users').doc(req.user.nickname).update({ pmc_dollars: admin.firestore.FieldValue.increment(-soldier.salary) });
  await db.collection('pmc_soldiers').add({ ...soldier, ownerNickname: req.user.nickname, status: 'ready' });
  res.json({ success: true });
});

// --- НОВЫЕ РОУТЫ ДЛЯ МИССИЙ И ПРОГРЕССА ---

app.post('/api/pmc/mission/start', authenticateToken, async (req, res) => {
  const { missionId, soldierIds } = req.body;
  
  // Проверка что миссия существует и доступна
  const mRef = db.collection('pmc_missions').doc(missionId);
  const mSnap = await mRef.get();
  if (!mSnap.exists || mSnap.data().status !== 'available') return res.status(404).json({ error: 'Миссия недоступна' });

  // Обновляем статус миссии и бойцов
  const batch = db.batch();
  batch.update(mRef, { status: 'in_progress', assignedSoldiers: soldierIds });
  
  for (const sId of soldierIds) {
    batch.update(db.collection('pmc_soldiers').doc(sId), { status: 'mission' });
  }
  
  await batch.commit();
  res.json({ success: true });
});

app.post('/api/pmc/base/upgrade', authenticateToken, async (req, res) => {
  const { type } = req.body;
  const user = req.user;
  const modules = user.pmc_baseModules || [];
  const mod = modules.find(m => m.type === type);
  if (!mod) return res.status(400).json({ error: 'Модуль не найден' });

  const cost = mod.level * 25000;
  if (user.pmc_dollars < cost) return res.status(400).json({ error: 'Недостаточно средств' });

  mod.level += 1;
  await db.collection('users').doc(user.nickname).update({
    pmc_dollars: admin.firestore.FieldValue.increment(-cost),
    pmc_baseModules: modules
  });
  res.json({ success: true, newLevel: mod.level });
});

app.post('/api/pmc/end-turn', authenticateToken, async (req, res) => {
  const user = req.user;
  const batch = db.batch();
  
  // 1. Находим все миссии в процессе
  const missionsSnap = await db.collection('pmc_missions')
    .where('ownerNickname', '==', user.nickname)
    .where('status', '==', 'in_progress').get();
  
  let totalProfit = 0;
  let totalRep = 0;
  const reports = [];

  for (const mDoc of missionsSnap.docs) {
    const mission = mDoc.data();
    const sIds = mission.assignedSoldiers || [];
    
    // Получаем реальные данные бойцов
    const sSnaps = await Promise.all(sIds.map(id => db.collection('pmc_soldiers').doc(id).get()));
    const squad = sSnaps.map(snap => ({ id: snap.id, ...snap.data() }));

    // Симуляция
    const medLevel = (user.pmc_baseModules.find(m => m.type === 'medical') || { level: 1 }).level;
    const result = simulateMission(squad, mission, medLevel);
    
    totalProfit += result.profit;
    if (result.isSuccess) totalRep += 5; else totalRep -= 2;
    
    // Обновляем миссию (завершена)
    batch.update(mDoc.ref, { status: 'completed', result: result.isSuccess ? 'success' : 'failure' });
    
    // Создаем лог
    await db.collection('pmc_logs').add({
        ownerNickname: user.nickname,
        week: user.pmc_currentWeek,
        report: result.report,
        profit: result.profit,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    // Обновляем бойцов
    for (const update of result.squadUpdates) {
      const sRef = db.collection('pmc_soldiers').doc(update.id);
      if (update.status === 'dead') {
         batch.delete(sRef);
      } else {
         batch.update(sRef, { 
             status: update.status, 
             health: admin.firestore.FieldValue.increment(update.healthChange),
             xp: admin.firestore.FieldValue.increment(update.xpGain)
         });
      }
    }
  }

  // 2. Расходы на зарплату
  const allSoldiers = await db.collection('pmc_soldiers').where('ownerNickname', '==', user.nickname).get();
  const salarySum = allSoldiers.docs.reduce((acc, d) => acc + (d.data().salary || 0), 0);
  totalProfit -= salarySum;

  // 3. Обновляем пользователя
  batch.update(db.collection('users').doc(user.nickname), {
    pmc_dollars: admin.firestore.FieldValue.increment(totalProfit),
    pmc_reputation: admin.firestore.FieldValue.increment(totalRep),
    pmc_currentWeek: admin.firestore.FieldValue.increment(1)
  });

  await batch.commit();
  res.json({ success: true, profit: totalProfit, week: user.pmc_currentWeek + 1 });
});

app.post('/api/admin/deploy', authenticateToken, async (req, res) => {
  const adminNick = process.env.ADMIN_NICKNAME || 'Aboba';
  if (req.user.nickname !== adminNick) {
    return res.status(403).json({ error: 'Admin only' });
  }

  const { exec } = require('child_process');
  
  // We specify the absolute path to the deploy script.
  // We use bash so output correctly returns and we can troubleshoot if needed.
  exec('/root/deploy.sh', (error, stdout, stderr) => {
    if (error) {
      console.error(`Deploy error: ${error}`);
      return res.status(500).json({ error: 'Deploy script failed', details: stderr });
    }
    console.log(`Deploy output: ${stdout}`);
    res.json({ success: true, output: stdout });
  });
});

app.listen(PORT, '0.0.0.0', () => console.log(`PMC Server on port ${PORT} (0.0.0.0)`));


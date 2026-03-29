const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');

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

// --- CORS, SECURITY & LOGGING ---
app.use(helmet());
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

// --- RATE LIMITERS ---
const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30, // Limit each IP to 30 requests per API route per windowMs
  message: { error: 'Слишком много запросов, подождите немного.' }
});

app.use('/api/', apiLimiter);

// --- МИДДЛВАР АВТОРИЗАЦИИ (JWT ID Token) ---
const authenticateToken = async (req, res, next) => {
  if (req.method === 'OPTIONS') return next();

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Auth missing' });
  }
  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;
    
    // Ищем пользователя по UID
    const usersRef = admin.firestore().collection('users');
    const snapshot = await usersRef.where('uid', '==', uid).limit(1).get();
    
    if (snapshot.empty) {
      console.warn('[AUTH] User not found by UID:', uid);
      return res.status(404).json({ error: 'User not found in database' });
    }
    
    // Ожидаем, что 1 профиль привязан к 1 UID
    const userDoc = snapshot.docs[0];
    req.user = { nickname: userDoc.id, ...userDoc.data() };
    next();
  } catch (err) {
    console.error('[AUTH] Failed to verify ID token:', err.message);
    return res.status(403).json({ error: 'Invalid auth token', detail: err.message });
  }
};

// --- СХЕМЫ ВАЛИДАЦИИ (ZOD) ---
const transferSchema = z.object({
  target: z.string().min(2, 'Никнейм должен быть от 2 символов').trim(),
  amount: z.number().int().positive('Сумма должна быть больше нуля')
});

function validateRequest(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body); // Очистка и валидация
      next();
    } catch (error) {
      return res.status(400).json({ error: error.errors[0].message });
    }
  };
}

// --- БАНКОВСКИЕ ОПЕРАЦИИ ---
app.post('/api/bank/transfer', authenticateToken, validateRequest(transferSchema), async (req, res) => {
  const { target, amount } = req.body;
  const senderId = req.user.nickname;
  const amt = amount; // Уже проверено через Zod

  if (target.toLowerCase() === senderId.toLowerCase()) {
    return res.status(400).json({ error: 'Нельзя перевести самому себе' });
  }

  try {
    const db = admin.firestore();
    
    await db.runTransaction(async (transaction) => {
      const senderRef = db.collection('users').doc(senderId);
      const targetRef = db.collection('users').doc(target);
      const settingsRef = db.collection('settings').doc('global');
      
      const [senderSnap, targetSnap, settingsSnap] = await Promise.all([
        transaction.get(senderRef),
        transaction.get(targetRef),
        transaction.get(settingsRef)
      ]);
      
      if (!senderSnap.exists) throw new Error('Ошибка отправителя');
      if (!targetSnap.exists) throw new Error('Получатель не найден');
      
      const settings = settingsSnap.exists ? settingsSnap.data() : { bankTransferCommission: 20 };
      const rate = settings.bankTransferCommission ?? 20;
      const commission = Math.floor(amt * (rate / 100));
      const totalDeduction = amt + commission;
      
      const senderData = senderSnap.data();
      const targetData = targetSnap.data();
      
      if (senderData.balance < totalDeduction) {
        throw new Error(`Недостаточно средств. Нужно ${totalDeduction} с учетом комиссии ${rate}%`);
      }
      
      // 1. Обновление балансов
      transaction.update(senderRef, {
        balance: admin.firestore.FieldValue.increment(-totalDeduction),
        updatedAt: Date.now()
      });
      
      transaction.update(targetRef, {
        balance: admin.firestore.FieldValue.increment(amt),
        updatedAt: Date.now()
      });
      
      // 2. Лог для отправителя
      const sLogRef = db.collection('bank_transactions').doc();
      transaction.set(sLogRef, {
        userId: senderId,
        type: 'withdraw',
        amount: -totalDeduction,
        balanceAfter: senderData.balance - totalDeduction,
        description: `Перевод игроку ${target}`,
        commission,
        createdAt: Date.now()
      });
      
      // 3. Лог для получателя
      const rLogRef = db.collection('bank_transactions').doc();
      transaction.set(rLogRef, {
        userId: target,
        type: 'deposit',
        amount: amt,
        balanceAfter: targetData.balance + amt,
        description: `Перевод от ${senderId}`,
        createdAt: Date.now()
      });
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Transfer Error:', error);
    res.status(500).json({ error: error.message || 'Ошибка сервера при переводе' });
  }
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


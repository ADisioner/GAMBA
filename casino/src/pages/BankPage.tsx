import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Landmark, 
  ArrowUpRight, 
  ArrowDownLeft, 
  History, 
  CreditCard, 
  Wallet, 
  AlertCircle,
  TrendingUp,
  Clock
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { collection, query, where, orderBy, limit, getDocs, addDoc, doc, updateDoc, increment, runTransaction } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { formatDynamicBalance, formatBalance } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Header } from '@/components/layout/Header'
import type { BankTransaction, UserProfile } from '@/types'
import { getDoc } from 'firebase/firestore'

type BankTab = 'dashboard' | 'deposit' | 'credits' | 'history' | 'transfer'

export function BankPage() {
  const { profile, settings, refreshProfile } = useAuth()
  const [activeTab, setActiveTab] = useState<BankTab>('dashboard')
  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [loading, setLoading] = useState(false)
  
  // States for forms
  const [depositAmount, setDepositAmount] = useState('')
  const [creditAmount, setCreditAmount] = useState('')
  const [transferTarget, setTransferTarget] = useState('')
  const [transferAmount, setTransferAmount] = useState('')

  useEffect(() => {
    if (profile) {
      loadTransactions()
    }
  }, [profile])

  async function loadTransactions() {
    if (!profile) return
    try {
      // Упрощаем запрос, чтобы избежать ошибок отсутствующих индексов в Firestore
      const q = query(
        collection(db, 'bank_transactions'),
        where('userId', '==', profile.nickname)
      )
      const snap = await getDocs(q)
      const txs = snap.docs.map(d => ({ id: d.id, ...d.data() } as BankTransaction))
      // Сортируем локально по дате (от новых к старым)
      txs.sort((a, b) => b.createdAt - a.createdAt)
      setTransactions(txs.slice(0, 20))
    } catch (e) {
      console.error('Transactions load error:', e)
      toast.error('Не удалось загрузить историю')
    }
  }

  async function logTransaction(type: BankTransaction['type'], amount: number, description: string, balanceAfter: number, commission: number = 0) {
    if (!profile) return
    await addDoc(collection(db, 'bank_transactions'), {
      userId: profile.nickname,
      type,
      amount,
      balanceAfter,
      description,
      commission,
      createdAt: Date.now()
    })
  }

  async function handleDeposit() {
    const amt = parseInt(depositAmount)
    if (isNaN(amt) || amt <= 0) {
      toast.error('Введите корректную сумму')
      return
    }
    if (!profile) return

    setLoading(true)
    try {
      const bonusPercent = settings?.bankDepositBonus || 0
      const bonusAmt = Math.floor(amt * (bonusPercent / 100))
      const totalAmt = amt + bonusAmt
      const newBalance = profile.balance + totalAmt
      await updateDoc(doc(db, 'users', profile.nickname), {
        balance: increment(totalAmt),
        updatedAt: Date.now()
      })
      await logTransaction('deposit', totalAmt, `Пополнение счета (Бонус ${bonusPercent}%)`, newBalance)
      await refreshProfile()
      setDepositAmount('')
      toast.success(`Счет пополнен на ${formatBalance(amt)}!`)
    } catch (e) {
      toast.error('Ошибка при пополнении')
    } finally {
      setLoading(false)
    }
  }

  async function takeCredit(type: 'loan' | 'overdraft') {
    const amt = parseInt(creditAmount)
    if (isNaN(amt) || amt <= 0) {
      toast.error('Введите сумму кредита')
      return
    }
    if (!profile) return

    if (amt > 100000) {
      toast.error('Максимальный кредит: 🪙100,000')
      return
    }

    setLoading(true)
    try {
      const debt = profile.bankDebt || 0
      const rate = settings?.bankCreditRate || 80
      const commission = type === 'loan' ? Math.floor(amt * (rate / 100)) : 0
      const newDebt = debt + amt + commission
      const newBalance = profile.balance + amt

      await updateDoc(doc(db, 'users', profile.nickname), {
        balance: increment(amt),
        bankDebt: increment(amt + commission),
        updatedAt: Date.now()
      })

      await logTransaction('credit_take', amt, `${type === 'loan' ? 'Микрозаем' : 'Кредитное плечо'}`, newBalance, commission)
      await refreshProfile()
      setCreditAmount('')
      toast.success(`Кредит одобрен! Получено ${formatBalance(amt)}`)
    } catch (e) {
      toast.error('Ошибка при обработке кредита')
    } finally {
      setLoading(false)
    }
  }

  async function handlePayDebt() {
    if (!profile || !profile.bankDebt || profile.bankDebt <= 0) return
    
    const amountToPay = profile.bankDebt
    if (profile.balance < amountToPay) {
      toast.error('Недостаточно фишек для полного погашения')
      return
    }

    setLoading(true)
    try {
      const newBalance = profile.balance - amountToPay
      await updateDoc(doc(db, 'users', profile.nickname), {
        balance: increment(-amountToPay),
        bankDebt: 0,
        updatedAt: Date.now()
      })
      await logTransaction('credit_pay', -amountToPay, 'Погашение задолженности', newBalance)
      await refreshProfile()
      toast.success('Задолженность полностью погашена!')
    } catch (e) {
      toast.error('Ошибка при оплате')
    } finally {
      setLoading(false)
    }
  }

  async function handleTransfer() {
    const amt = parseInt(transferAmount)
    const target = transferTarget.trim()
    if (isNaN(amt) || amt <= 0 || !target) {
      toast.error('Заполните все поля')
      return
    }
    if (!profile) return

    if (target.toLowerCase() === profile.nickname.toLowerCase()) {
      toast.error('Нельзя отправить фишки самому себе')
      return
    }

    const rate = settings?.bankTransferCommission || 20
    const commission = Math.floor(amt * (rate / 100)) 
    const totalDeduction = amt + commission
    
    setLoading(true)
    try {
      // ПЕРЕНОСИМ ЛОГИКУ ПЕРЕВОДА НА СЕРВЕР
      // Это решает ошибку "Missing or insufficient permissions", 
      // так как обычный игрок не может менять баланс другого игрока в Firestore напрямую.
      // Теперь используется подлинный Firebase ID Токен для аутентификации
      if (!auth.currentUser) throw new Error('Не авторизован в Firebase');
      const token = await auth.currentUser.getIdToken();
      const apiUrl = import.meta.env.VITE_API_URL || '/api'
      
      // Настраиваем URL: если в apiUrl уже есть '/api', то не добавляем его дважды.
      const fetchUrl = apiUrl.endsWith('/api') ? `${apiUrl}/bank/transfer` : `${apiUrl}/api/bank/transfer`
      
      const response = await fetch(fetchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          target: target, 
          amount: amt 
        })
      })

      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Ошибка при переводе на сервере')
      }

      await refreshProfile()
      setTransferAmount('')
      setTransferTarget('')
      toast.success(`Отправлено ${formatBalance(amt)} пользователю ${target}!`)
    } catch (e: any) {
      console.error('Transfer error:', e)
      toast.error(e.message || 'Ошибка при переводе')
    } finally {
      setLoading(false)
    }
  }

  function setMaxTransfer() {
    if (!profile) return
    const rate = settings?.bankTransferCommission || 20
    // Находим X, чтобы X + X*(rate/100) <= balance
    // X * (1 + rate/100) = balance
    // X = balance / (1 + rate/100)
    const maxAmt = Math.floor(profile.balance / (1 + (rate / 100)))
    if (maxAmt > 0) {
      setTransferAmount(maxAmt.toString())
    }
  }

  if (!profile) return null

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="max-w-6xl mx-auto px-4 py-8">
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
                <Landmark className="w-5 h-5 text-violet-400" />
              </div>
              <span className="text-sm font-medium text-violet-400 uppercase tracking-wider">Глобальный Банк GAMBA</span>
            </div>
            <h1 className="font-serif text-3xl md:text-4xl font-bold">Личный кабинет</h1>
          </div>
          
          <div className="flex gap-4">
            <Card className="bg-marble/30 backdrop-blur-md p-4 border-gold/20 min-w-[160px]">
              <p className="text-xs text-muted-foreground uppercase mb-1">Ваши фишки</p>
              <p className="text-xl font-bold text-gold-light">{formatDynamicBalance(profile.balance)}</p>
            </Card>
            <Card className="bg-red-500/5 backdrop-blur-md p-4 border-red-500/20 min-w-[160px]">
              <p className="text-xs text-muted-foreground uppercase mb-1">Задолженность</p>
              <p className="text-xl font-bold text-red-400">{formatDynamicBalance(profile.bankDebt || 0)}</p>
            </Card>
          </div>
        </header>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 p-1 bg-marble/20 rounded-xl border border-gold/10 mb-8 max-w-fit">
          {[
            { id: 'dashboard', icon: Landmark, label: 'Обзор' },
            { id: 'deposit', icon: Wallet, label: 'Пополнить' },
            { id: 'transfer', icon: ArrowUpRight, label: 'Перевод' },
            { id: 'credits', icon: CreditCard, label: 'Кредиты' },
            { id: 'history', icon: History, label: 'Транзакции' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as BankTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id 
                ? 'bg-gold text-velvet-dark shadow-glow-gold' 
                : 'text-muted-foreground hover:bg-marble/30'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <section className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {activeTab === 'dashboard' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} key="dashboard" className="space-y-6">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Card className="p-6 bg-gradient-to-br from-violet-900/40 to-indigo-900/40 border-violet-500/20">
                      <div className="flex justify-between items-start mb-4">
                        <div className="p-3 rounded-full bg-violet-500/20 text-violet-400">
                          <TrendingUp className="w-6 h-6" />
                        </div>
                        <span className="text-[10px] bg-violet-500/20 text-violet-400 px-2 py-0.5 rounded-full font-bold uppercase">Активен</span>
                      </div>
                      <h3 className="text-lg font-semibold mb-1">Сберегательный счет</h3>
                      <p className="text-sm text-muted-foreground mb-4">Ваши накопления работают на вас. Скоро: система вкладов.</p>
                      <Button variant="outline" className="w-full border-violet-500/30 text-violet-200" onClick={() => setActiveTab('deposit')}>Пополнить</Button>
                    </Card>

                    <Card className="p-6 bg-gradient-to-br from-gold-900/20 to-marble/40 border-gold/20">
                      <div className="flex justify-between items-start mb-4">
                        <div className="p-3 rounded-full bg-gold/20 text-gold-light">
                          <CreditCard className="w-6 h-6" />
                        </div>
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-bold uppercase">Доступен</span>
                      </div>
                      <h3 className="text-lg font-semibold mb-1">Кредитный лимит</h3>
                      <p className="text-sm text-muted-foreground mb-4">Ваш лимит: {formatBalance(100000)}. Используйте для игры.</p>
                      <Button variant="outline" className="w-full border-gold/30 text-gold-light" onClick={() => setActiveTab('credits')}>Управлять</Button>
                    </Card>
                  </div>

                  <Card className="p-6 border-gold/10">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-serif text-xl font-bold">Последние операции</h3>
                      <div className="flex gap-2">
                         <span className="text-[10px] text-muted-foreground bg-gold/5 px-2 py-1 rounded border border-gold/10 uppercase font-bold tracking-widest">Комиссия 20% активна</span>
                        <Button variant="ghost" size="sm" className="text-xs text-gold" onClick={() => setActiveTab('history')}>
                          Показать все
                        </Button>
                      </div>
                    </div>
                    <TransactionList transactions={transactions.slice(0, 5)} />
                  </Card>
                </motion.div>
              )}

              {activeTab === 'transfer' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} key="transfer">
                  <Card className="p-8 border-gold/20 bg-marble-light/20 backdrop-blur-xl max-w-xl mx-auto">
                    <h2 className="font-serif text-2xl font-bold mb-6 flex items-center gap-2">
                       <ArrowUpRight className="w-6 h-6 text-gold" /> Перевод фишек
                    </h2>
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">Никнейм получателя</label>
                        <Input 
                          placeholder="Введите логин..." 
                          value={transferTarget} 
                          onChange={e => setTransferTarget(e.target.value)}
                          className="bg-marble/50 border-gold/20 focus-visible:ring-gold"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">Количество фишек</label>
                        <div className="relative">
                          <Input 
                            placeholder="0" 
                            type="number" 
                            value={transferAmount} 
                            onChange={e => setTransferAmount(e.target.value)}
                            className="text-2xl h-14 bg-marble/50 border-gold/30 pr-32"
                          />
                          <button 
                             onClick={setMaxTransfer}
                             className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded-md bg-gold/10 text-gold-light hover:bg-gold/20 text-[10px] font-bold uppercase transition-all"
                          >
                             Макс
                          </button>
                          <div className="absolute right-4 -bottom-6 text-[10px] text-gold/60 font-medium">
                            +{Math.floor(parseInt(transferAmount || '0') * ((settings?.bankTransferCommission || 20) / 100))} комиссия
                          </div>
                        </div>
                      </div>
                      <div className="p-4 rounded-xl bg-gold/5 border border-gold/10">
                        <p className="text-sm flex justify-between">
                          <span className="text-muted-foreground">Итого спишется:</span>
                          <span className="font-bold text-gold-light">
                            {formatBalance(parseInt(transferAmount || '0') + Math.floor(parseInt(transferAmount || '0') * ((settings?.bankTransferCommission || 20) / 100)))}
                          </span>
                        </p>
                      </div>
                      <Button className="w-full h-14 text-lg font-serif bg-gold hover:bg-gold-dark text-velvet-dark shadow-glow-gold" disabled={loading} onClick={handleTransfer}>
                        {loading ? 'Проверка...' : 'Отправить фишки'}
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              )}

              {activeTab === 'deposit' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} key="deposit">
                  <Card className="p-8 border-gold/20 bg-marble-light/20 backdrop-blur-xl">
                    <h2 className="font-serif text-2xl font-bold mb-6 flex items-center gap-2">
                       <Wallet className="w-6 h-6 text-gold" /> Пополнить фишки
                    </h2>
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">Количество фишек</label>
                        <Input 
                          placeholder="0" 
                          type="number" 
                          value={depositAmount} 
                          onChange={e => setDepositAmount(e.target.value)}
                          className="text-2xl h-14 bg-marble/50 border-gold/30 focus-visible:ring-gold"
                        />
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {[1000, 5000, 25000, 100000].map(val => (
                          <button 
                            key={val} 
                            onClick={() => setDepositAmount(val.toString())}
                            className="py-2 text-xs font-bold rounded-lg bg-marble/30 border border-gold/10 hover:bg-gold/10 hover:border-gold/30 transition-all"
                          >
                            +{formatBalance(val)}
                          </button>
                        ))}
                      </div>
                      <Button className="w-full h-14 text-lg font-serif bg-gold hover:bg-gold-dark text-velvet-dark" disabled={loading} onClick={handleDeposit}>
                        {loading ? 'Обработка...' : 'Подтвердить пополнение'}
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              )}

              {activeTab === 'credits' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} key="credits" className="space-y-6">
                  <div className="grid sm:grid-cols-2 gap-6">
                    <Card className="p-6 border-red-500/20 bg-red-500/5">
                      <div className="flex items-center gap-2 mb-4">
                        <Clock className="w-5 h-5 text-red-400" />
                        <h3 className="font-bold">Микрозаем</h3>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        Срочные фишки под **{settings?.bankCreditRate || 80}%**. <br />
                        Пример: берёте 🪙1,000, отдаёте 🪙{1000 + Math.floor(1000 * ((settings?.bankCreditRate || 80) / 100))}.
                      </p>
                      <Input 
                        placeholder="Сумма..." 
                        className="mb-4 bg-marble/50 border-red-500/20" 
                        type="number"
                        value={creditAmount}
                        onChange={e => setCreditAmount(e.target.value)}
                      />
                      <Button className="w-full bg-red-500 hover:bg-red-600 text-white" disabled={loading} onClick={() => takeCredit('loan')}>Взять заем</Button>
                    </Card>

                    <Card className="p-6 border-violet-500/20 bg-violet-500/5">
                      <div className="flex items-center gap-2 mb-4">
                        <TrendingUp className="w-5 h-5 text-violet-400" />
                        <h3 className="font-bold">Кредитное плечо</h3>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                         Беспроцентный долг. <br />
                         Будет списываться с будущих выигрышей (Скоро).
                      </p>
                      <Button variant="outline" className="w-full border-violet-500/40 text-violet-400" disabled={loading} onClick={() => takeCredit('overdraft')}>Активировать</Button>
                    </Card>
                  </div>

                  {profile.bankDebt && profile.bankDebt > 0 && (
                    <Card className="p-6 border-gold/20 bg-gold/5 flex flex-col md:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-full bg-gold/10 text-gold-light">
                          <Landmark className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="font-bold">Погасить задолженность</h3>
                          <p className="text-sm text-muted-foreground">Сумма к оплате: **{formatBalance(profile.bankDebt)}**</p>
                        </div>
                      </div>
                      <Button className="w-full md:w-auto bg-gold hover:bg-gold-dark text-velvet-dark font-bold px-8" onClick={handlePayDebt} disabled={loading}>
                        Выплатить всё
                      </Button>
                    </Card>
                  )}
                </motion.div>
              )}

              {activeTab === 'history' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} key="history">
                  <Card className="p-0 border-gold/10 overflow-hidden">
                    <div className="p-6 border-b border-gold/10">
                      <h3 className="font-serif text-xl font-bold">История транзакций</h3>
                    </div>
                    <TransactionList transactions={transactions} />
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <aside className="space-y-6">
            <Card className="p-6 bg-gold/5 border-gold/20">
               <h4 className="flex items-center gap-2 font-bold mb-4 text-gold">
                 <AlertCircle className="w-4 h-4" /> Важная информация
               </h4>
               <ul className="space-y-3 text-xs text-muted-foreground">
                 <li>• Все транзакции фиксируются в реальном времени.</li>
                 <li>• Кредиты увеличивают вашу задолженность в профиле.</li>
                 <li>• Непогашенные долги могут привести к ограничению аватарок.</li>
                 <li>• GAMBA Bank не является реальным банком 🎰.</li>
               </ul>
            </Card>
            
            <Card className="p-6 border-violet-500/10">
               <h4 className="font-bold mb-3 text-violet-400">Tycoon Статус</h4>
               <p className="text-xs text-muted-foreground leading-relaxed">
                 Ваш банковский рейтинг влияет на доступность новых зданий в Tycoon Manager. Копите золото, чтобы разблокировать элитную недвижимость.
               </p>
            </Card>
          </aside>
        </section>
      </main>
    </div>
  )
}

function TransactionList({ transactions }: { transactions: BankTransaction[] }) {
  if (transactions.length === 0) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        <History className="w-12 h-12 mx-auto mb-4 opacity-20" />
        <p>У вас еще нет транзакций</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-gold/5">
      {transactions.map((tx) => (
        <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-marble/10 transition-colors">
          <div className="flex items-center gap-4">
            <div className={`p-2 rounded-lg ${
              tx.type === 'deposit' ? 'bg-emerald-500/10 text-emerald-400' :
              tx.type === 'credit_take' ? 'bg-violet-500/10 text-violet-400' :
              tx.type === 'withdraw' ? 'bg-red-500/10 text-red-500' :
              'bg-marble/30 text-gold-light'
            }`}>
              {tx.type === 'deposit' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
            </div>
            <div>
              <p className="text-sm font-semibold">{tx.description}</p>
              <div className="flex items-center gap-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{new Date(tx.createdAt).toLocaleString()}</p>
                {tx.commission && tx.commission > 0 && (
                  <span className="text-[9px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded border border-red-500/10">
                    Комиссия: {formatBalance(tx.commission)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-sm font-bold ${tx.type === 'deposit' || (tx.type === 'game' && tx.amount > 0) ? 'text-emerald-400' : 'text-red-400'}`}>
              {tx.amount > 0 ? '+' : ''}{formatDynamicBalance(tx.amount)}
            </p>
            <p className="text-[10px] text-muted-foreground">Итог: {formatBalance(tx.balanceAfter)}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

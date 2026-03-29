import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Shield, Users, Target, Briefcase, Activity, Database, DollarSign, AlertTriangle, Lock, LayoutGrid, CheckCircle, Info, Navigation, Map } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { TheaterMap } from '@/components/pmc/TheaterMap';

// --- TYPES ---
interface Soldier {
  id: string;
  name: string;
  callsign: string;
  portrait: string;
  shooting: number;
  tactics: number;
  medical: number;
  melee: number;
  engineering: number;
  health: number;
  energy: number;
  morale: number;
  salary: number;
  status: string;
  nationality: string;
}

interface Contract {
  id: string;
  title: string;
  description: string;
  region: string;
  difficulty: string;
  reward: number;
  status: string;
}

interface MissionLog {
  id: string;
  week: number;
  report: string;
  result: string;
  profit: number;
}

interface GlobalEvent {
  id: string;
  title: string;
  regionId: string;
  rewardMult: number;
  desc: string;
}

const PMCPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'hq' | 'barracks' | 'market' | 'base' | 'logs'>('hq');
  const [profile, setProfile] = useState<any>(null);
  const [soldiers, setSoldiers] = useState<Soldier[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [globalContracts, setGlobalContracts] = useState<Contract[]>([]);
  const [events, setEvents] = useState<GlobalEvent[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [recruits, setRecruits] = useState<Soldier[]>([]);
  const [loading, setLoading] = useState(true);
  const [missionModal, setMissionModal] = useState<Contract | null>(null);
  const [selectedSoldierIds, setSelectedSoldierIds] = useState<string[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  const API_URL = 'http://localhost:4000/api';

  const handleHire = async (soldier: Soldier) => {
    try {
      const res = await fetch(`${API_URL}/pmc/hire`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(soldier)
      });
      if (res.ok) {
        toast.success(`Боец ${soldier.callsign} нанят в отряд!`, {
          position: 'bottom-left',
          icon: <Users className="text-amber-500" size={18} />,
          style: {
            background: '#09090b',
            border: '1px solid #f59e0b',
            color: '#f59e0b',
            fontFamily: 'monospace',
            textTransform: 'uppercase'
          }
        });
        fetchData();
      } else {
        const d = await res.json();
        toast.error(d.error || 'Ошибка при найме');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpgrade = async (type: string) => {
    try {
      const res = await fetch(`${API_URL}/pmc/base/upgrade`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ type })
      });
      if (res.ok) {
        toast.success('Модернизация базы завершена!', {
          icon: <Shield className="text-amber-500" size={18} />
        });
        fetchData();
      } else {
        const d = await res.json();
        toast.error(d.error);
      }
    } catch (e) {
      console.error(e);
    }
  };
  const handleStartMission = async () => {
    if (!missionModal || selectedSoldierIds.length === 0) return;
    try {
      const res = await fetch(`${API_URL}/pmc/mission/start`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          missionId: missionModal.id, 
          soldierIds: selectedSoldierIds 
        })
      });
      if (res.ok) {
        toast.success('Группа выдвинулась на задание!', {
          position: 'bottom-right'
        });
        setMissionModal(null);
        setSelectedSoldierIds([]);
        fetchData();
      } else {
        const d = await res.json();
        toast.error(d.error);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleEndTurn = async () => {
    try {
       const res = await fetch(`${API_URL}/pmc/end-turn`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      toast.success('Неделя завершена оперативно!', {
        description: `Чистая прибыль штаба: $${data.profit}`,
        icon: <Activity className="text-green-500" size={18} />
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const TabButton = ({ id, icon: Icon, label }: { id: any, icon: any, label: string }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center space-x-2 px-6 py-3 border-b-2 transition-all ${
        activeTab === id ? 'border-amber-500 text-amber-500 bg-amber-500/5' : 'border-transparent text-gray-400 hover:text-white hover:bg-white/5'
      }`}
    >
      <Icon size={18} />
      <span className="font-medium text-sm">{label}</span>
    </button>
  );

  // Читаем никнейм из казино
  const casinoUser = localStorage.getItem('gamba_user') || sessionStorage.getItem('gamba_user');
  const token = casinoUser; // Используем никнейм как токен для связи

  const [callsignInput, setCallsignInput] = useState('');
  const [onboarding, setOnboarding] = useState(false);

  useEffect(() => {
    if (!casinoUser) {
      // Если не вошел в казино - отправляем регистрироваться там
      navigate('/login');
    } else {
      fetchData();
    }
  }, [casinoUser]);

  const handleOnboarding = async () => {
    if (callsignInput.length < 3) {
      alert('Позывной должен быть не менее 3 символов');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/auth/onboarding`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ callsign: callsignInput })
      });
      if (res.ok) {
        setOnboarding(false);
        fetchData();
      } else {
        const d = await res.json();
        alert(d.error);
      }
    } catch (e) {
      alert('Ошибка штаба');
    }
  };

  const fetchData = async () => {
    if (!token) {
      console.warn('PMC: No token found in localStorage');
      return;
    }
    setLoading(true);
    console.log(`PMC: Starting data fetch for user: ${token}`);

    try {
      const headers = { 
        'Authorization': `Bearer ${encodeURIComponent(token)}`,
        'Accept': 'application/json' 
      };

      console.log('PMC: Fetching profile...');
      const pRes = await fetch(`${API_URL}/profile`, { headers });
      console.log(`PMC: Profile response status: ${pRes.status}`);

      if (!pRes.ok) {
        let errorData;
        try {
            errorData = await pRes.json();
        } catch(err) {
            errorData = { error: `Сервер вернул ошибку ${pRes.status}, но данные не в формате JSON (возможно сервер упал).` };
        }
        console.error('PMC: Server returned profile error:', errorData);
        setProfile(errorData);
        setLoading(false);
        return;
      }

      const pData = await pRes.json();
      console.log('PMC: Profile data received:', pData);

      const [cRes, rRes, gRes, lRes, eRes] = await Promise.all([
        fetch(`${API_URL}/market/contracts`, { headers }),
        fetch(`${API_URL}/market/recruits`, { headers }),
        fetch(`${API_URL}/market/global`, { headers }),
        fetch(`${API_URL}/leaderboard`),
        fetch(`${API_URL}/market/events`)
      ]);

      if (pData && !pData.pmc_callsign) {
        setOnboarding(true);
      }

      setProfile(pData);
      setSoldiers(pData.soldiers || []);
      setContracts(await cRes.json());
      setRecruits(await rRes.json());
      setGlobalContracts(await gRes.json());
      setLeaderboard(await lRes.json());
      setEvents(await eRes.json());
      
      console.log('PMC: All data synchronized.');
    } catch (e) {
      console.error('PMC: CRITICAL FETCH ERROR:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
       <div className="p-10 text-white font-mono animate-pulse border border-white/10 rounded-2xl">
          ИНИЦИАЛИЗАЦИЯ ШТАБА...
       </div>
    </div>
  );

  // Если пользователь не авторизован в казино вообще
  if (!casinoUser) return (
     <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
        <div className="text-center p-12 bg-[#141417] rounded-3xl border border-white/5">
           <AlertTriangle className="mx-auto text-amber-500 mb-6" size={64} />
           <h2 className="text-2xl font-black text-white mb-4 uppercase italic">ТРЕБУЕТСЯ АВТОРИЗАЦИЯ В КАЗИНО</h2>
           <button 
             onClick={() => navigate('/login')}
             className="bg-amber-600 hover:bg-amber-500 text-white px-8 py-4 rounded-xl font-black uppercase italic tracking-widest transition-all"
           >
             ПЕРЕЙТИ К ВХОДУ
           </button>
        </div>
     </div>
  );

  // ЭКРАН ОНБОРДИНГА (Выбор позывного)
  if (onboarding) return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center p-6">
       <div className="max-w-md w-full bg-[#141417] p-10 rounded-3xl border border-white/5 shadow-2xl">
          <div className="text-center mb-10">
             <Shield className="mx-auto text-amber-500 mb-6" size={64} />
             <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">ЧВК: КОНТРАКТ</h2>
             <p className="text-gray-500 text-xs mt-2 uppercase tracking-widest font-bold">РЕГИСТРАЦИЯ НОВОГО КОМАНДИРА</p>
          </div>

          <div className="space-y-6">
             <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl mb-6">
                <p className="text-[10px] text-amber-500 uppercase font-black tracking-widest text-center">
                  Добро пожаловать в сектор, {casinoUser}! <br/> Выберите ваш боевой позывной:
                </p>
             </div>

             <input 
               type="text" 
               placeholder="ВАШ ПОЗЫВНОЙ (CALLSIGN)" 
               value={callsignInput}
               onChange={e => setCallsignInput(e.target.value.toUpperCase())}
               className="w-full bg-black/40 border border-white/10 rounded-xl px-5 py-4 text-white placeholder-gray-600 focus:border-amber-500/50 outline-none transition-all font-mono text-center text-xl tracking-widest"
             />

             <button 
               onClick={handleOnboarding}
               className="w-full bg-amber-600 hover:bg-amber-500 text-white py-5 rounded-2xl font-black uppercase italic tracking-widest transition-all shadow-xl active:scale-[0.98]"
             >
               ПОДТВЕРДИТЬ И ПРИНЯТЬ КОМАНДОВАНИЕ
             </button>
          </div>
       </div>
    </div>
  );

  // ОШИБКА СЕРВЕРА
  if (!profile || profile.error) return (
     <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
        <div className="text-center p-12 bg-red-500/5 border border-red-500/10 rounded-3xl max-w-lg">
           <AlertTriangle className="mx-auto text-red-500 mb-4" size={48} />
           <h2 className="text-xl font-bold text-white mb-2 italic uppercase tracking-tighter">СЕРВИС ДАННЫХ НЕДОСТУПЕН</h2>
           <div className="bg-black/50 p-4 rounded-xl border border-white/5 my-6">
              <p className="text-red-400 font-mono text-xs uppercase mb-2">ОТЛАДОЧНАЯ ИНФОРМАЦИЯ:</p>
              <p className="text-gray-400 text-sm font-medium">
                {profile?.error || 'Сервер не вернул данные профиля. Проверьте статус бэкенда.'}
              </p>
           </div>
           
           <div className="flex flex-col space-y-4">
              <button 
                onClick={fetchData} 
                className="bg-white/5 hover:bg-white/10 text-white px-8 py-3 rounded-xl border border-white/10 text-xs font-black tracking-widest transition-all"
              >
                ПОВТОРИТЬ ПОПЫТКУ
              </button>
              <button 
                onClick={() => navigate('/login')}
                className="text-amber-500 hover:text-white transition-colors uppercase font-black text-[10px] tracking-[0.2em]"
              >
                ПЕРЕЗАЙТИ В КАЗИНО (LOGIN)
              </button>
           </div>
        </div>
     </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-gray-100 p-6 font-sans">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-8 bg-[#141417] p-6 rounded-2xl border border-white/5 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => navigate('/')}
            className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center border border-white/10 transition-all group"
            title="В КАЗИНО"
          >
            <LayoutGrid className="text-gray-400 group-hover:text-gold transition-colors" size={24} />
          </button>
          
          <div className="w-16 h-16 bg-amber-500/20 rounded-xl flex items-center justify-center border border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.1)]">
            <Shield className="text-amber-500" size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight uppercase italic">{profile.pmcName || 'PMC: CONTRACT'}</h1>
            <div className="flex items-center space-x-3 mt-1">
              <span className="bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border border-amber-500/20">НЕДЕЛЯ {profile.currentWeek}</span>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">РЕПУТАЦИЯ: {profile.reputation}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-8">
          <div className="flex space-x-6">
            <div className="text-right">
              <p className="text-[10px] text-gray-500 font-bold uppercase mb-1 tracking-widest">АКТИВЫ (USD)</p>
              <div className="flex items-center justify-end text-green-400 font-mono text-2xl font-bold">
                <DollarSign size={20} className="mr-1" />
                <span>{profile.dollars.toLocaleString()}</span>
              </div>
            </div>
            <div className="text-right">
               <p className="text-[10px] text-gray-500 font-bold uppercase mb-1 tracking-widest">РЕЗЕРВ (GOLD)</p>
               <div className="flex items-center justify-end text-amber-400 font-mono text-2xl font-bold">
                 <Database size={20} className="mr-1" />
                 <span>{profile.goldBars}</span>
               </div>
            </div>
          </div>
          <button 
            onClick={handleEndTurn}
            className="group relative bg-amber-600 hover:bg-amber-500 text-white px-8 py-4 rounded-xl font-black transition-all shadow-[0_0_30px_rgba(217,119,6,0.2)] active:scale-95 overflow-hidden"
          >
            <span className="relative z-10 tracking-[0.2em]">ЗАВЕРШИТЬ ХОД</span>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20 scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>
          </button>
        </div>
      </div>

      {/* TABS */}
      <div className="flex border-b border-white/5 mb-8 overflow-x-auto no-scrollbar">
        <TabButton id="hq" icon={Activity} label="ШТАБ" />
        <TabButton id="barracks" icon={Users} label="КАЗАРМЫ" />
        <TabButton id="market" icon={Briefcase} label="РЫНОК" />
        <TabButton id="base" icon={Database} label="БАЗА" />
        <TabButton id="logs" icon={Target} label="ОТЧЕТЫ" />
      </div>

      {/* CONTENT */}
      <div className="grid grid-cols-1 gap-6">
        
        {activeTab === 'hq' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
               <div className="bg-[#141417] rounded-2xl p-8 border border-white/5 shadow-lg">
                  <h3 className="text-sm font-black text-gray-500 mb-6 uppercase tracking-widest border-b border-white/5 pb-4">ОПЕРАТИВНАЯ СВОДКА</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {[
                      { label: 'ЛИЧНЫЙ СОСТАВ', val: soldiers.length, color: 'text-amber-500' },
                      { label: 'В ОПЕРАЦИИ', val: soldiers.filter(s=>s.status==='mission').length, color: 'text-blue-500' },
                      { label: 'ГОСПИТАЛИЗАЦИЯ', val: soldiers.filter(s=>s.status==='hospital').length, color: 'text-red-500' },
                      { label: 'ФОНД ЗАРПЛАТЫ', val: `$${soldiers.reduce((a,b)=>a+b.salary,0)}`, color: 'text-gray-400' },
                    ].map((stat, i) => (
                      <div key={i} className="bg-white/[0.02] p-6 rounded-2xl border border-white/5 hover:bg-white/[0.04] transition-colors">
                        <p className="text-[10px] text-gray-500 uppercase font-black mb-2 tracking-tighter">{stat.label}</p>
                        <p className={`text-3xl font-mono font-bold ${stat.color}`}>{stat.val}</p>
                      </div>
                    ))}
                  </div>
               </div>
               
               <div className="bg-[#141417] rounded-3xl p-8 border border-white/5 h-[400px] flex items-center justify-center overflow-hidden relative group shadow-inner">
                  <img src="https://images.unsplash.com/photo-1548345666-a5d24660efe3?q=80&w=1400" alt="map" className="absolute inset-0 w-full h-full object-cover opacity-20 grayscale group-hover:scale-105 transition-transform duration-[10s]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0b] via-transparent to-transparent"></div>
                  <div className="relative z-10 text-center">
                    <div className="w-20 h-20 border-2 border-dashed border-gray-600 rounded-full flex items-center justify-center mb-4 mx-auto animate-spin-slow">
                        <Target className="text-gray-600" size={32} />
                    </div>
                    <p className="text-gray-500 font-black tracking-[0.3em] uppercase text-sm">ИНТЕРАКТИВНАЯ КАРТА ТВД <br/><span className="text-[10px] text-amber-500/50">ДОСТУПНО В СЛЕДУЮЩЕМ ОБНОВЛЕНИИ</span></p>
                  </div>
               </div>
            </div>

            <div className="space-y-8">
               <div className="bg-[#141417] rounded-2xl p-6 border border-white/5 shadow-xl bg-gradient-to-br from-[#141417] via-[#141417] to-amber-900/10">
                  <h3 className="text-xs font-black text-amber-500 mb-6 uppercase tracking-widest flex items-center">
                    <Activity className="mr-2" size={16} />
                    <span>АКТУАЛЬНЫЕ СОБЫТИЯ</span>
                  </h3>
                  <div className="space-y-4">
                    {events.map((ev) => (
                      <div key={ev.id} className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                         <h4 className="text-xs font-black text-amber-500 mb-1 uppercase italic tracking-tighter">{ev.title}</h4>
                         <p className="text-[10px] text-gray-400 leading-relaxed mb-2">{ev.desc}</p>
                         <div className="flex items-center text-[9px] font-black text-green-500 bg-green-500/10 px-2 py-0.5 rounded w-fit">
                           BONUS: +{Math.round((ev.rewardMult - 1) * 100)}% REWARD
                         </div>
                      </div>
                    ))}
                  </div>
               </div>

               <div className="bg-[#141417] rounded-2xl p-6 border border-white/5 shadow-xl">
                  <h3 className="text-xs font-black text-gray-500 mb-6 uppercase tracking-widest flex items-center">
                    <Target className="text-amber-500 mr-2" size={16} />
                    <span>РЕЙТИНГ PMC</span>
                  </h3>
                  <div className="space-y-3">
                    {leaderboard.map((user, i) => (
                      <div key={i} className="flex justify-between items-center bg-white/[0.02] p-4 rounded-xl border border-white/5 hover:bg-white/[0.04] transition-all">
                         <div className="flex items-center space-x-4">
                            <span className="text-gray-600 font-mono text-sm font-black w-4">{i + 1}</span>
                            <div>
                              <p className="text-sm font-bold tracking-tight">{user.pmcName || user.nickname}</p>
                              <p className="text-[10px] text-gray-500 font-bold">REP: {user.reputation}</p>
                            </div>
                         </div>
                         <p className="text-green-500 font-mono text-sm font-bold">${user.dollars.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'barracks' && (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {soldiers.map(s => (
                <div key={s.id} className="bg-[#141417] rounded-2xl overflow-hidden border border-white/5 hover:border-amber-500/30 transition-all group shadow-xl">
                    <div className="relative h-48 bg-gradient-to-t from-[#141417] to-amber-900/20">
                       <img src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${s.callsign}`} alt="pro" className="w-full h-full object-contain" />
                       <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10">
                          <p className="text-[10px] font-bold text-gray-200">{s.nationality}</p>
                       </div>
                    </div>
                    <div className="p-6">
                       <h4 className="text-xl font-black italic tracking-tighter mb-1 uppercase">{s.callsign}</h4>
                       <p className="text-[10px] text-gray-500 font-bold uppercase mb-4">{s.name}</p>
                       
                       <div className="grid grid-cols-2 gap-4 mb-6">
                         {[
                            { label: 'ATK', val: s.shooting },
                            { label: 'TAC', val: s.tactics },
                            { label: 'MED', val: s.medical },
                            { label: 'ENG', val: s.engineering },
                         ].map((st, i) => (
                           <div key={i} className="bg-white/[0.02] p-2 rounded-lg border border-white/5">
                              <p className="text-[8px] text-gray-600 font-black mb-1">{st.label}</p>
                              <div className="flex items-center space-x-2">
                                <span className="text-xs font-mono font-bold text-amber-500">{st.val}</span>
                                <div className="flex-1 h-1 bg-black rounded-full overflow-hidden">
                                  <div className="h-full bg-amber-500" style={{ width: `${st.val}%` }}></div>
                                </div>
                              </div>
                           </div>
                         ))}
                       </div>

                       <div className="flex justify-between items-center pt-4 border-t border-white/5">
                          <div className="flex flex-col">
                             <span className="text-[8px] text-gray-500 font-black uppercase">ЗАРПЛАТА</span>
                             <span className="text-sm font-mono font-bold text-green-400">${s.salary}</span>
                          </div>
                          <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                            s.status === 'ready' ? 'bg-green-500/10 text-green-500' : 'bg-amber-500/10 text-amber-500'
                          }`}>
                            {s.status}
                          </div>
                       </div>
                    </div>
                </div>
              ))}
           </div>
        )}

        {activeTab === 'market' && (
           <div className="space-y-12">
              <TheaterMap 
                contracts={contracts}
                globalContracts={globalContracts}
                events={events}
                selectedRegion={selectedRegion}
                onSelectRegion={setSelectedRegion}
              />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                 <div className="space-y-8">
                 <h3 className="text-lg font-black italic uppercase tracking-[0.2em] flex items-center border-l-4 border-amber-500 pl-4">
                   <Users className="text-amber-500 mr-2" />
                   КАНДИДАТЫ НА НАЙМ
                 </h3>
                 <div className="space-y-4">
                    {recruits.map((r, i) => (
                       <div key={i} className="bg-[#141417] p-6 rounded-2xl border border-white/5 flex items-center justify-between group hover:border-amber-500/20 transition-all hover:translate-x-1">
                          <div className="flex items-center space-x-6">
                            <div className="w-16 h-16 bg-black rounded-xl border border-white/10 overflow-hidden group-hover:border-amber-500/30 transition-colors">
                               <img src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${r.callsign}`} alt="avatar" className="w-full h-full" />
                            </div>
                            <div>
                               <p className="font-black italic text-lg uppercase tracking-tight">{r.callsign}</p>
                               <div className="flex space-x-2 mt-1">
                                  <span className="text-[10px] text-gray-500 font-bold uppercase">СИЛА: {r.shooting + r.tactics}</span>
                                  <span className="text-[10px] text-amber-500 font-bold uppercase">MED: {r.medical}</span>
                               </div>
                            </div>
                          </div>
                          <div className="text-right">
                             <p className="text-green-500 font-mono text-lg font-bold mb-2">${r.salary.toLocaleString()}</p>
                             <button 
                               onClick={() => handleHire(r)}
                               className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all"
                             >
                               ЗАКЛЮЧИТЬ КОНТРАКТ
                             </button>
                          </div>
                       </div>
                    ))}
                 </div>
              </div>

              <div className="space-y-8">
                 <h3 className="text-lg font-black italic uppercase tracking-[0.2em] flex items-center border-l-4 border-amber-500 pl-4">
                   <Target className="text-amber-500 mr-2" />
                   ГЛОБАЛЬНЫЙ ТЕНДЕР
                 </h3>
                 <div className="grid grid-cols-1 gap-6">
                    {globalContracts.filter(c => !selectedRegion || c.region === selectedRegion).length === 0 ? (
                       <p className="text-gray-500 italic text-sm">В ДАННОМ РЕГИОНЕ НЕТ АКТИВНЫХ ГЛОБАЛЬНЫХ КОНТРАКТОВ</p>
                    ) : globalContracts.filter(c => !selectedRegion || c.region === selectedRegion).map(c => (
                       <div key={c.id} className="bg-amber-900/5 p-8 rounded-3xl border border-amber-500/30 relative overflow-hidden group hover:bg-amber-900/10 transition-all shadow-[0_0_40px_rgba(245,158,11,0.05)]">
                          <div className="absolute top-0 right-0 bg-amber-500 text-black px-4 py-1 text-[10px] font-black uppercase italic tracking-widest shadow-xl">PRIORITY CONTRACT</div>
                          <h4 className="font-black text-2xl mb-3 text-amber-500 uppercase italic tracking-tight">{c.title}</h4>
                          <p className="text-sm text-gray-400 mb-6 leading-relaxed border-l-2 border-white/5 pl-4">{c.description}</p>
                          <div className="flex items-center justify-between pt-6 border-t border-white/10">
                              <div className="flex flex-col">
                                 <span className="text-[10px] text-gray-500 font-black uppercase mb-1">ФИНАНСОВОЕ ВОЗНАГРАЖДЕНИЕ</span>
                                 <p className="text-amber-400 font-mono text-3xl font-bold italic">${c.reward.toLocaleString()}</p>
                              </div>
                              {profile.reputation < (c.difficulty === 'suicide' ? 200 : 100) ? (
                                <div className="flex items-center space-x-2 bg-red-500/10 text-red-500 px-6 py-3 rounded-2xl border border-red-500/20">
                                   <Lock size={16} />
                                   <span className="text-[10px] font-black uppercase">REP REQ: {c.difficulty === 'suicide' ? 200 : 100}</span>
                                </div>
                              ) : (
                                <button 
                                  onClick={() => {
                                    setMissionModal(c);
                                    setSelectedSoldierIds([]);
                                  }}
                                  className="bg-amber-500 hover:bg-amber-400 text-black px-8 py-3 rounded-2xl font-black uppercase italic tracking-widest shadow-xl transition-all active:scale-95"
                                >
                                  УЧАСТВОВАТЬ
                                </button>
                              )}
                          </div>
                       </div>
                    ))}
                 </div>
              </div>
            </div>
              <div className="space-y-8 mt-12 col-span-1 lg:col-span-2">
                  <h3 className="text-lg font-black italic uppercase tracking-[0.2em] flex items-center border-l-4 border-white/20 pl-4">
                   <Navigation className="text-white/50 mr-2" />
                   ДОСТУПНЫЕ ОПЕРАЦИИ {selectedRegion && `- ${selectedRegion.toUpperCase()}`}
                 </h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {contracts.filter(c => !selectedRegion || c.region === selectedRegion).length === 0 ? (
                        <p className="text-gray-500 italic text-sm col-span-2">В ДАННОМ РЕГИОНЕ НЕТ ДОСТУПНЫХ ОПЕРАЦИЙ</p>
                    ) : contracts.filter(c => !selectedRegion || c.region === selectedRegion).map(c => (
                        <div key={c.id} className="bg-[#141417] p-8 rounded-3xl border border-white/5 relative overflow-hidden group hover:border-white/20 transition-all">
                           <div className={`absolute top-0 right-0 px-4 py-1 text-[10px] font-black uppercase italic tracking-widest rounded-bl-2xl ${
                              c.difficulty === 'easy' ? 'bg-green-500/20 text-green-500 border-l border-b border-green-500/30' : 
                              c.difficulty === 'medium' ? 'bg-amber-500/20 text-amber-500 border-l border-b border-amber-500/30' : 
                              'bg-red-500/20 text-red-500 border-l border-b border-red-500/30'
                           }`}>
                              {c.difficulty}
                           </div>
                           <h4 className="font-black text-xl mb-3 uppercase tracking-tight">{c.title}</h4>
                           <p className="text-xs text-gray-500 mb-6 leading-relaxed">{c.description}</p>
                           <div className="flex items-center justify-between pt-6 border-t border-white/5">
                              <p className="text-green-500 font-mono text-2xl font-bold tracking-tighter">${c.reward.toLocaleString()}</p>
                              <button 
                                onClick={() => {
                                  setMissionModal(c);
                                  setSelectedSoldierIds([]);
                                }}
                                className="bg-white/5 hover:bg-white/10 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/10 transition-all active:scale-95"
                              >
                                ВЫБРАТЬ ПОДРАЗДЕЛЕНИЕ
                              </button>
                           </div>
                        </div>
                    ))}
                 </div>
              </div>
           </div>
        )}

        {activeTab === 'base' && (
           <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {(profile.baseModules || []).map((m: any) => (
                <div key={m.id} className="bg-[#141417] p-8 rounded-3xl border border-white/5 relative overflow-hidden group shadow-xl">
                   <div className="absolute top-0 right-0 bg-white/5 px-4 py-1 text-[10px] font-black uppercase tracking-widest rounded-bl-2xl">LVL {m.level}</div>
                   <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-6 border border-amber-500/20 group-hover:scale-110 transition-transform">
                      {m.type === 'medical' && <Activity className="text-amber-500" size={32} />}
                      {m.type === 'barracks' && <Users className="text-amber-500" size={32} />}
                      {m.type === 'training' && <Target className="text-amber-500" size={32} />}
                   </div>
                   <h4 className="text-xl font-black uppercase italic mb-2 tracking-tight">
                     {m.type === 'medical' && 'МЕДИЦИНСКИЙ БЛОК'}
                     {m.type === 'barracks' && 'ЖИЛОЙ КОРПУС'}
                     {m.type === 'training' && 'УЧЕБНЫЙ ЦЕНТР'}
                   </h4>
                   <p className="text-xs text-gray-500 mb-8 leading-relaxed">
                     {m.type === 'medical' && 'Снижает вероятность гибели тяжело раненых бойцов на поле боя.'}
                     {m.type === 'barracks' && 'Увеличивает максимальный лимит нанимаемых сотрудников.'}
                     {m.type === 'training' && 'Повышает скорость набора опыта бойцами после каждой миссии.'}
                   </p>
                   
                   <div className="pt-6 border-t border-white/5 flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-gray-600 font-black uppercase mb-1">СТОИМОСТЬ МОДЕРНИЗАЦИИ</span>
                        <span className="text-amber-500 font-mono text-xl font-bold italic">${(m.level * 25000).toLocaleString()}</span>
                      </div>
                      <button 
                         onClick={() => handleUpgrade(m.type)}
                         className="bg-white/5 hover:bg-white/10 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/10 transition-all active:scale-95"
                      >
                         УЛУЧШИТЬ
                      </button>
                   </div>
                </div>
              ))}
           </div>
        )}
      </div>

      {/* MISSION MODAL */}
      {missionModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12 overflow-hidden">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl animate-in fade-in" onClick={() => setMissionModal(null)}></div>
          
          <div className="relative w-full max-w-4xl bg-[#141417] border border-white/5 rounded-[40px] shadow-2xl flex flex-col max-h-full overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-10 border-b border-white/5 flex justify-between items-start">
               <div>
                 <p className="text-amber-500 font-black text-xs uppercase tracking-[0.3em] mb-2 italic">ФОРМИРОВАНИЕ ОТРЯДА</p>
                 <h2 className="text-3xl font-black uppercase tracking-tighter text-white">{missionModal.title}</h2>
                 <p className="text-gray-500 text-xs mt-2 uppercase font-bold tracking-widest">РЕГИОН: {missionModal.region} / СЛОЖНОСТЬ: {missionModal.difficulty}</p>
               </div>
               <button 
                 onClick={() => setMissionModal(null)}
                 className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/5 transition-colors"
               >
                 <Lock size={20} className="text-gray-500" />
               </button>
            </div>

            <div className="flex-1 p-10 overflow-y-auto no-scrollbar grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
               <div className="space-y-4 pr-4">
                 <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">ДОСТУПНЫЕ БОЙЦЫ</h3>
                 {soldiers.filter(s => s.status === 'ready').length === 0 ? (
                   <div className="p-8 text-center bg-white/5 rounded-2xl border border-white/5 italic text-gray-500 text-sm">
                     НЕТ СВОБОДНЫХ БОЙЦОВ В КАЗАРМЕ
                   </div>
                 ) : (
                   soldiers.filter(s => s.status === 'ready').map(s => (
                     <div 
                       key={s.id} 
                       onClick={() => setSelectedSoldierIds(prev => 
                         prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id]
                       )}
                       className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${
                         selectedSoldierIds.includes(s.id) ? 'bg-amber-500/10 border-amber-500/50 translate-x-1' : 'bg-white/5 border-white/5 hover:border-white/10'
                       }`}
                     >
                        <div className="flex items-center space-x-4">
                           <div className="w-10 h-10 bg-black rounded-lg border border-white/10 overflow-hidden">
                              <img src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${s.callsign}`} alt="pro" />
                           </div>
                           <div>
                              <p className="text-sm font-black uppercase tracking-tight">{s.callsign}</p>
                              <p className="text-[9px] text-gray-500 font-bold">POWER: {s.shooting + s.tactics}</p>
                           </div>
                        </div>
                        {selectedSoldierIds.includes(s.id) && <CheckCircle className="text-amber-500" size={16} />}
                     </div>
                   ))
                 )}
               </div>

               <div className="sticky top-0 bg-white/5 rounded-3xl p-8 border border-white/5 flex flex-col justify-between h-fit">
                  <div>
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">СВОДКА ОПЕРАЦИИ</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">ВЫБРАНО БОЙЦОВ</span>
                        <span className="text-xs text-white font-mono font-black">{selectedSoldierIds.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">СУММАРНАЯ МОЩЬ</span>
                        <span className="text-xs text-amber-500 font-mono font-black">
                           {soldiers.filter(s => selectedSoldierIds.includes(s.id)).reduce((acc, s) => acc + s.shooting + s.tactics, 0)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                         <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">НАГРАДА</span>
                         <span className="text-xs text-green-500 font-mono font-black font-bold">${missionModal.reward.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-12 space-y-4">
                     <button 
                       onClick={handleStartMission}
                       disabled={selectedSoldierIds.length === 0}
                       className={`w-full py-5 rounded-2xl font-black uppercase italic tracking-widest transition-all shadow-xl active:scale-[0.98] ${
                         selectedSoldierIds.length > 0 
                           ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-500/20' 
                           : 'bg-white/5 text-gray-600 cursor-not-allowed border border-white/5'
                       }`}
                     >
                       РАЗВЕРНУТЬ ОТРЯД
                     </button>
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PMCPage;

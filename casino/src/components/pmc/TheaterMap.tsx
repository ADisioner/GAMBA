import React from 'react';
import { Target, AlertTriangle, Shield, Crosshair } from 'lucide-react';

interface Contract {
    id: string;
    title: string;
    region: string;
    difficulty: string;
    reward: number;
}

interface GlobalEvent {
    id: string;
    regionId: string;
    title: string;
    rewardMult: number;
}

interface TheaterMapProps {
    contracts: Contract[];
    globalContracts: Contract[];
    events: GlobalEvent[];
    selectedRegion: string | null;
    onSelectRegion: (region: string | null) => void;
}

const REGIONS = [
    { id: 'na', name: 'СЕВЕРНАЯ АМЕРИКА', x: 22, y: 35, isHQ: true },
    { id: 'latam', name: 'ЛАТИНСКАЯ АМЕРИКА', x: 28, y: 70, isHQ: false },
    { id: 'europe', name: 'ЕВРОПА', x: 52, y: 30, isHQ: false },
    { id: 'africa', name: 'АФРИКА', x: 53, y: 55, isHQ: false },
    { id: 'middle_east', name: 'БЛИЖНИЙ ВОСТОК', x: 62, y: 45, isHQ: false },
    { id: 'asia', name: 'АЗИЯ', x: 75, y: 35, isHQ: false },
];

export const TheaterMap: React.FC<TheaterMapProps> = ({ contracts, globalContracts, events, selectedRegion, onSelectRegion }) => {

    const getAllContractsForRegion = (regionId: string) => {
        return [...contracts, ...globalContracts].filter(c => c.region === regionId);
    };

    const getEventsForRegion = (regionId: string) => {
        return events.filter(e => e.regionId === regionId);
    };

    return (
        <div className="relative w-full h-[500px] bg-[#0a0a0c] rounded-[40px] border border-white/5 overflow-hidden mb-8 group shadow-2xl">
            {/* Real World Map Graphic */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.2] flex items-center justify-center p-12">
               <svg viewBox="0 0 1000 500" className="w-full h-full fill-white/80 filter sepia saturate-[2] hue-rotate-[-30deg]">
                  {/* Americas */}
                  <path d="M120,80 c20,0 40,10 50,30 s10,50 -10,120 s-40,100 -50,150 s-20,50 -40,30 s-10,-50 10,-100 s30,-80 40,-130" />
                  <path d="M220,250 c30,0 60,30 50,100 s-40,150 -70,180 s-50,20 -60,-20 s10,-80 40,-130 s40,-130 40,-130" />
                  {/* Eurasia & Africa */}
                  <path d="M500,50 c100,0 200,20 250,50 s50,100 -50,150 s-150,50 -250,50 s-150,-50 -100,-150 s50,-100 150,-100" />
                  <path d="M520,220 c40,0 80,40 70,120 s-50,180 -100,200 s-70,-20 -60,-80 s30,-150 90,-240" />
                  {/* Australia */}
                  <rect x="750" y="350" width="80" height="50" rx="20" />
                  <rect x="0" y="0" width="1000" height="500" fill="url(#dots)" />
                  <defs>
                     <pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse">
                        <circle cx="2" cy="2" r="1.5" fill="white" opacity="0.1" />
                     </pattern>
                  </defs>
               </svg>
            </div>
                 {/* Decorative radar lines minimal */}
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] border border-white/5 rounded-full opacity-30"></div>
            
             <div className="absolute top-6 left-8 flex items-center space-x-3 pointer-events-none z-20">
                <Target className="text-amber-500 animate-pulse" size={20} />
                <span className="text-amber-500 font-black text-xs tracking-[0.3em] uppercase italic">GLOBAL THEATER GRID</span>
            </div>
            
            <div className="absolute top-6 right-8 z-20">
                {selectedRegion && (
                   <button 
                     onClick={() => onSelectRegion(null)}
                     className="bg-red-500/10 hover:bg-red-500/20 text-red-500 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-red-500/20 shadow-xl"
                   >
                     СБРОС ФИЛЬТРА
                   </button>
                )}
            </div>

            {/* Nodes */}
            {REGIONS.map(region => {
                const regionContracts = getAllContractsForRegion(region.id);
                const regionEvents = getEventsForRegion(region.id);
                const hasGlobal = globalContracts.some(c => c.region === region.id);
                const isSelected = selectedRegion === region.id;
                const active = regionContracts.length > 0 || regionEvents.length > 0;

                return (
                    <div 
                        key={region.id}
                        onClick={() => {
                            if (!region.isHQ) {
                                onSelectRegion(isSelected ? null : region.id);
                            }
                        }}
                        className={`absolute flex flex-col items-center justify-center transition-all duration-500 group/node cursor-pointer ${
                            isSelected ? 'z-50 scale-125' : 'z-10 hover:scale-110'
                        } ${!region.isHQ && !isSelected && selectedRegion ? 'opacity-30' : 'opacity-100'}`}
                        style={{ left: `${region.x}%`, top: `${region.y}%`, transform: `translate(-50%, -50%)` }}
                    >
                        {/* Status indicators */}
                        <div className="absolute -top-6 flex space-x-1 pointer-events-none">
                           {hasGlobal && <AlertTriangle size={12} className="text-red-500 animate-pulse" />}
                           {regionEvents.length > 0 && <AlertTriangle size={12} className="text-purple-500" />}
                        </div>

                        {/* Core Node */}
                        <div className={`relative flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all ${
                            region.isHQ ? 'border-blue-500 bg-blue-500/20 cursor-default' : 
                            isSelected ? 'border-amber-500 bg-amber-500/20 shadow-[0_0_30px_rgba(245,158,11,0.5)]' :
                            active ? 'border-amber-500/50 bg-amber-500/10' : 'border-white/10 bg-white/5'
                        }`}>
                            {region.isHQ ? <Shield size={14} className="text-blue-500" /> : <Crosshair size={14} className={`transition-all ${isSelected ? 'text-amber-500' : 'text-gray-500'}`} />}
                            
                            {/* Ping effect if active */}
                            {!region.isHQ && active && !isSelected && (
                                <span className="absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-20 animate-ping pointer-events-none"></span>
                            )}
                        </div>

                        {/* Label */}
                        <div className="absolute top-10 flex flex-col items-center min-w-[120px] pointer-events-none">
                            <span className={`text-[10px] font-black uppercase tracking-widest whitespace-nowrap px-2 py-1 rounded bg-[#0a0a0c]/80 border backdrop-blur-sm transition-all ${
                                isSelected ? 'text-amber-500 border-amber-500/50' : 'text-gray-400 border-white/5 group-hover/node:border-white/20 group-hover/node:text-white'
                            }`}>
                                {region.name}
                            </span>
                            
                            {/* Stats */}
                            <div className={`mt-1 flex space-x-2 text-[9px] font-bold ${active || region.isHQ ? 'opacity-100' : 'opacity-0'} transition-opacity`}>
                               {region.isHQ ? (
                                   <span className="text-blue-400">ШТАБ-КВАРТИРА</span>
                               ) : (
                                   <>
                                     {regionContracts.length > 0 && <span className="text-amber-500">{regionContracts.length} OPS</span>}
                                   </>
                               )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

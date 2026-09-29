import React, { useState, useEffect, useCallback } from 'react';
import { Swords } from 'lucide-react';

const EMBER_COUNT = 35;

const Ember = ({ delay, duration, left, size }) => (
  <div
    className="splash-ember"
    style={{
      left: `${left}%`,
      bottom: `-${Math.random() * 20}px`,
      width: `${size}px`,
      height: `${size}px`,
      animationDelay: `${delay}s`,
      animationDuration: `${duration}s`,
      filter: `blur(${size > 4 ? 1 : 0}px)`,
    }}
  />
);

export const SplashScreen = ({ onEnter }) => {
  const [phase, setPhase] = useState('intro'); // intro -> ready -> exiting
  const [embers] = useState(() =>
    Array.from({ length: EMBER_COUNT }, (_, i) => ({
      id: i,
      delay: Math.random() * 5,
      duration: 4 + Math.random() * 6,
      left: Math.random() * 100,
      size: 2 + Math.random() * 5,
    }))
  );

  useEffect(() => {
    const timer = setTimeout(() => setPhase('ready'), 800);
    return () => clearTimeout(timer);
  }, []);

  const handleEnter = useCallback(() => {
    setPhase('exiting');
    setTimeout(() => onEnter(), 600);
  }, [onEnter]);

  // Allow Enter key or Space to start
  useEffect(() => {
    const handler = (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && phase === 'ready') {
        handleEnter();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, handleEnter]);

  return (
    <div
      className={`splash-container transition-opacity duration-500 ${
        phase === 'exiting' ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Floating Ember Particles */}
      {embers.map((e) => (
        <Ember key={e.id} {...e} />
      ))}

      {/* Vignette Overlay */}
      <div className="splash-vignette" />

      {/* Faint radial glow behind title */}
      <div
        className="absolute w-[500px] h-[500px] rounded-full opacity-20 pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(201, 168, 76, 0.4) 0%, transparent 70%)',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -55%)',
        }}
      />

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Sword Icon */}
        <div
          className={`transition-all duration-700 ${
            phase !== 'intro'
              ? 'opacity-100 scale-100'
              : 'opacity-0 scale-50 rotate-[-180deg]'
          }`}
          style={{
            transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
            transitionDelay: '200ms',
          }}
        >
          <div className="p-5 rounded-2xl bg-gradient-to-br from-crimson-400 via-crimson-600 to-obsidian-950 border-2 border-crimson-400/50 shadow-crimson-glow-lg">
            <Swords className="w-12 h-12 text-parchment-50" />
          </div>
        </div>

        {/* Game Title */}
        <div className="flex flex-col items-center gap-3">
          <h1
            className={`font-cinzel font-black text-5xl md:text-6xl text-gold-gradient transition-all duration-1000 ${
              phase !== 'intro'
                ? 'opacity-100 tracking-[0.15em]'
                : 'opacity-0 tracking-[0.5em] blur-lg'
            }`}
            style={{
              textShadow: '0 0 40px rgba(201, 168, 76, 0.3), 0 4px 8px rgba(0, 0, 0, 0.5)',
              transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
              transitionDelay: '400ms',
              filter: phase !== 'intro' ? 'blur(0)' : 'blur(8px)',
            }}
          >
            BATTLE SANDBOX
          </h1>

          {/* Ornate Divider Line */}
          <div
            className={`transition-all duration-700 ${
              phase !== 'intro' ? 'opacity-100 w-64' : 'opacity-0 w-0'
            }`}
            style={{ transitionDelay: '700ms' }}
          >
            <div className="ornate-divider" />
          </div>

          <p
            className={`font-crimsonText text-lg text-parchment-300/80 italic tracking-wide transition-all duration-700 ${
              phase !== 'intro' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
            style={{ transitionDelay: '900ms' }}
          >
            Forge Your Armies • Command the Arena • Witness the Carnage
          </p>
        </div>

        {/* Enter Button */}
        <button
          onClick={handleEnter}
          disabled={phase !== 'ready'}
          className={`group relative mt-4 transition-all duration-700 ${
            phase === 'ready' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
          style={{ transitionDelay: '1200ms' }}
        >
          <div className="btn-fantasy-battle px-10 py-4 text-base flex items-center gap-3 group-hover:gap-4 transition-all">
            <Swords className="w-5 h-5" />
            <span>ENTER THE ARENA</span>
            <Swords className="w-5 h-5 scale-x-[-1]" />
          </div>

          {/* Subtle glow ring on hover */}
          <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
            style={{
              boxShadow: '0 0 40px rgba(196, 30, 58, 0.4), 0 0 80px rgba(196, 30, 58, 0.2)',
            }}
          />
        </button>

        {/* Version Badge */}
        <span
          className={`font-crimsonText text-xs text-gold-700/60 tracking-widest uppercase transition-all duration-700 ${
            phase !== 'intro' ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ transitionDelay: '1500ms' }}
        >
          v2.0 — Ultra Physics Simulator
        </span>
      </div>
    </div>
  );
};

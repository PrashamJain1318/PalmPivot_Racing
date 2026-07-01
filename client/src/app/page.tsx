'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useSettingsStore, GameTheme, GameWeather, HandMode } from '@/store/settingsStore';
import { useMapStore } from '@/store/mapStore';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, Settings, ShieldCheck, Trophy, Palette, 
  ChevronRight, Camera, Image, Sun, Moon, CloudRain, 
  Eye, HelpCircle, Map as MapIcon, RotateCcw, Heart,
  ShoppingCart, User, ShieldAlert, X, Gamepad2, Compass,
  Activity, Gauge, Award, Flame, Navigation, Cpu, Bell, Coins, Diamond, Sliders, Tv
} from 'lucide-react';
import dynamic from 'next/dynamic';

const GameCanvas = dynamic(() => import('@/game/canvas/GameCanvas'), { ssr: false });
const GarageShowroom = dynamic(() => import('@/components/GarageShowroom'), { ssr: false });

import HUD from '@/components/HUD';
import SoundController from '@/game/systems/SoundController';
import GarageCustomizer from '@/components/GarageCustomizer';
import GestureCalibrator from '@/components/GestureCalibrator';
import WebcamDetector from '@/components/WebcamDetector';

export default function Home() {
  // Store States
  const { 
    status, setStatus, currentCar, presets, coins, diamonds, 
    xp, level, xpToNextLevel, achievements, dailyChallenges, resetProgress,
    cameraPermission, saveCarPreset, addCoins, currentTrack, setTrack,
    handDetected, handConfidence, currentGesture, webcamFps, webcamLighting,
    // New arcade states
    resetRaceStats, score, distance, coinsCollected, health, fuel
  } = useGameStore();

  // Settings
  const { 
    soundVolume, setSoundVolume, musicVolume, setMusicVolume,
    theme, setTheme, weather, setWeather, handMode, setHandMode,
    debugKeyboard, setDebugKeyboard 
  } = useSettingsStore();

  // Maps
  const { 
    tracks, searchQuery, setSearchQuery, selectedCategory, setSelectedCategory, 
    selectedDifficulty, setSelectedDifficulty, toggleFavorite 
  } = useMapStore();

  // State controls
  const [isLoading, setIsLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadLog, setLoadLog] = useState('Initializing sub-modules...');
  const [activeTab, setActiveTab] = useState<'menu' | 'garage' | 'calibration' | 'leaderboard' | 'settings' | 'map'>('menu');
  const [countdownNumber, setCountdownNumber] = useState<number | string>(3);
  
  // Custom modals
  const [cameraHelpOpen, setCameraHelpOpen] = useState(false);
  const [settingsHelpOpen, setSettingsHelpOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  
  // Camera prompt toggle
  const [triggerCameraPrompt, setTriggerCameraPrompt] = useState(false);

  // Photo Mode states
  const photoModeActive = useGameStore((s) => s.photoModeActive);
  const setPhotoModeActive = useGameStore((s) => s.setPhotoModeActive);
  const [activeFilter, setActiveFilter] = useState<'none' | 'cyberpunk' | 'vintage' | 'monochrome'>('none');
  const [savedPhotos, setSavedPhotos] = useState<string[]>([]);
  const [showGallery, setShowGallery] = useState(false);

  // Multiplayer matchmaking mockup
  const [matchmakingActive, setMatchmakingActive] = useState(false);
  const [matchmakingTime, setMatchmakingTime] = useState(6);
  const [matchmakingStatus, setMatchmakingStatus] = useState('Searching for drivers...');

  // Sound synthesis triggers
  const synthSound = (type: 'hover' | 'click' | 'transition') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (type === 'hover') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(580, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(920, ctx.currentTime + 0.06);
        gain.gain.setValueAtTime(0.03, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.06);
      } else if (type === 'click') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(240, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(480, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.07, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.12);
      } else if (type === 'transition') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(140, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(550, ctx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.25);
      }
    } catch (e) {}
  };

  // Preloader progress loop
  useEffect(() => {
    const interval = setInterval(() => {
      setLoadProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsLoading(false);
            synthSound('transition');
          }, 350);
          return 100;
        }
        const nextProgress = p + Math.floor(Math.random() * 9) + 4;
        const progress = Math.min(100, nextProgress);
        
        if (progress < 25) setLoadLog('Calibrating physics engine...');
        else if (progress < 50) setLoadLog('Booting gesture recognition models...');
        else if (progress < 75) setLoadLog('Syncing online driver records...');
        else setLoadLog('Igniting V8 sports engine... Ignition Ready!');
        
        return progress;
      });
    }, 110);
    return () => clearInterval(interval);
  }, []);

  // Sync photos on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('palmpivot_photos');
      if (stored) setSavedPhotos(JSON.parse(stored));
    }
  }, []);

  // Auto transition to calibration gate on camera permissions granted
  useEffect(() => {
    if (cameraPermission === 'granted' && triggerCameraPrompt) {
      setTriggerCameraPrompt(false);
      setActiveTab('calibration');
    }
  }, [cameraPermission, triggerCameraPrompt]);

  // Matchmaking countdown simulation
  useEffect(() => {
    if (!matchmakingActive) return;
    const interval = setInterval(() => {
      setMatchmakingTime((t) => {
        if (t <= 1) {
          clearInterval(interval);
          setMatchmakingActive(false);
          setStatus('countdown');
          return 0;
        }
        if (t === 4) setMatchmakingStatus('Lobby secured! Synchronizing drivers (6/8)...');
        if (t === 2) setMatchmakingStatus('Finalizing track grid slots...');
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [matchmakingActive]);

  // Race Countdown sequence manager
  useEffect(() => {
    if (status !== 'countdown') return;
    setCountdownNumber(3);
    
    // Play initial 3 chime
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.2);
      }
    } catch (e) {}

    let count = 3;
    const interval = setInterval(() => {
      count -= 1;
      if (count === 0) {
        setCountdownNumber('GO!');
        try {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioCtx) {
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            gain.gain.setValueAtTime(0.04, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(); osc.stop(ctx.currentTime + 0.3);
          }
        } catch (e) {}
      } else if (count < 0) {
        clearInterval(interval);
        setStatus('playing');
      } else {
        setCountdownNumber(count);
        try {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioCtx) {
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, ctx.currentTime);
            gain.gain.setValueAtTime(0.04, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(); osc.stop(ctx.currentTime + 0.2);
          }
        } catch (e) {}
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [status, setStatus]);

  const activeCarPreset = presets[currentCar] || {
    paint: '#ffffff',
    underglow: '#ffd700',
    performance: { engine: 2, suspension: 2, turbo: 1, nitro: 2 }
  };

  const selectedTrackData = useMemo(() => {
    return tracks.find(t => t.id === currentTrack) || tracks[0];
  }, [tracks, currentTrack]);

  const handleStartRace = () => {
    synthSound('click');
    resetRaceStats(); // Always reset stats before starting a new race!
    setActiveTab('calibration');
  };

  // Luxury white glass card configurations
  const glassCardClass = 'bg-white/80 border border-white/60 shadow-xl text-slate-800 backdrop-blur-xl rounded-2xl p-5';
  const subTextClass = 'text-slate-500 text-[9px] uppercase tracking-wider';

  return (
    <main className="relative w-screen h-screen overflow-hidden font-mono select-none bg-sky-100">
      
      {/* Sound Synthesizer Node */}
      <SoundController />

      {/* 3D coastal highway background rendering */}
      {!isLoading && (status === 'menu' || status === 'garage' || status === 'calibration') && (
        <div className="absolute inset-0 z-0 pointer-events-none">
          <GarageShowroom
            paintColor={activeCarPreset.paint}
            underglowColor={activeCarPreset.underglow}
          />
        </div>
      )}

      {/* Ambient daytime sun vignette overlay */}
      {!isLoading && (status === 'menu' || status === 'garage' || status === 'calibration') && (
        <div className="absolute inset-0 z-1 pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0)_40%,rgba(255,255,255,0.2)_100%)]" />
      )}

      {/* AAA Rebranded Loading Screen */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-sky-100 flex flex-col items-center justify-center z-50 p-6"
          >
            {/* Spinning Tire SVGLoader */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.1, ease: 'linear' }}
              className="w-28 h-28 border-4 border-dashed border-amber-500 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.25)]"
            >
              <div className="w-20 h-20 border-2 border-sky-500 rounded-full flex items-center justify-center">
                <div className="w-10 h-10 bg-sky-200 rounded-full animate-ping" />
              </div>
            </motion.div>

            {/* Glowing Rebranded Logo & Tagline */}
            <h1 className="text-4xl font-black italic tracking-widest text-slate-800 mt-8 uppercase">
              PALMPIVOT RACING
            </h1>
            <span className="text-[9px] text-[#00CFFF]/90 font-extrabold tracking-widest mt-2 uppercase">
              AI Powered Hand Gesture Racing Experience
            </span>

            {/* Tips panel */}
            <div className="max-w-xs text-center mt-6 text-[8px] text-slate-500 border border-white/80 bg-white/70 p-3 rounded-lg uppercase leading-relaxed shadow-sm">
              💡 TIP: Hold your palm wide open in front of your camera to accelerate. Close your fist to pull the handbrake.
            </div>

            {/* Progress metrics */}
            <div className="w-64 mt-6">
              <div className="flex justify-between items-center text-[10px] text-slate-700 font-bold mb-2">
                <span className="animate-pulse">{loadLog}</span>
                <span>{loadProgress}%</span>
              </div>
              <div className="w-full h-1.5 bg-white/40 rounded-full overflow-hidden border border-white/60">
                <div 
                  className="h-full bg-gradient-to-r from-amber-400 to-yellow-500 transition-all duration-100" 
                  style={{ width: `${loadProgress}%` }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main UI Interface Panels Grid */}
      {!isLoading && (
        <AnimatePresence mode="wait">
          {status !== 'playing' && status !== 'paused' && status !== 'gameover' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 flex flex-col justify-between p-6 bg-transparent"
            >
              
              {/* 1. FLOATING WHITE GLASS NAVIGATION BAR */}
              <div className="w-full flex justify-between items-center bg-white/75 border border-white/70 px-8 py-3.5 rounded-full backdrop-blur-xl shadow-xl pointer-events-auto">
                <div className="flex flex-col">
                  <span className="text-xl font-black italic tracking-widest text-slate-800">PALMPIVOT RACING</span>
                  <span className="text-[7px] text-slate-500 tracking-widest font-bold uppercase mt-0.5">AI Powered Hand Gesture Racing Experience</span>
                </div>

                {/* Navbar links */}
                <div className="flex items-center gap-6 text-[10px] font-extrabold tracking-wider">
                  {[
                    { id: 'menu', label: 'HOME' },
                    { id: 'garage', label: 'GARAGE' },
                    { id: 'map', label: 'CIRCUITS' },
                    { id: 'leaderboard', label: 'RECORDS' },
                    { id: 'settings', label: 'SETTINGS' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => { synthSound('hover'); setActiveTab(tab.id as any); }}
                      className={`transition uppercase pb-0.5 ${
                        activeTab === tab.id 
                          ? 'text-[#00CFFF] border-b-2 border-[#00CFFF] font-black' 
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                  <button
                    onClick={() => { synthSound('click'); setActiveTab('calibration'); }}
                    className={`transition uppercase pb-0.5 ${
                      activeTab === 'calibration' ? 'text-amber-500 border-b-2 border-amber-500 font-black' : 'text-slate-600 hover:text-[#00CFFF]'
                    }`}
                  >
                    CALIBRATE
                  </button>
                </div>

                {/* Profile panel widget */}
                <div className="flex items-center gap-4 text-xs">
                  {/* Notification Bell */}
                  <div className="relative">
                    <button 
                      onClick={() => { synthSound('hover'); setBellOpen(!bellOpen); }}
                      className="p-2 border border-white/50 rounded-xl bg-white/60 hover:bg-white/90 transition relative"
                    >
                      <Bell className="w-4 h-4 text-amber-500" />
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
                    </button>
                    
                    {/* Bell Dropdown */}
                    {bellOpen && (
                      <div className="absolute right-0 mt-3 w-56 bg-white/95 border border-white/60 rounded-2xl p-4 shadow-2xl z-50 text-[10px] space-y-2.5 text-slate-800">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                          <span className="font-bold text-amber-500">MESSAGES</span>
                          <button onClick={() => setBellOpen(false)}><X className="w-3.5 h-3.5" /></button>
                        </div>
                        <div className="text-slate-600 leading-normal">
                          🎁 Welcome Gift: <span className="text-[#00CFFF] font-bold">100 Coins</span> and <span className="text-amber-500 font-bold">10 Diamonds</span> credited to your driver license!
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Economy balances */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 border border-white/50 rounded-xl bg-white/60">
                      <Coins className="w-3.5 h-3.5 text-yellow-600" />
                      <span className="font-bold text-slate-800">{coins}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 border border-white/50 rounded-xl bg-white/60">
                      <Diamond className="w-3.5 h-3.5 text-cyan-600" />
                      <span className="font-bold text-slate-800">{diamonds}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. DYNAMIC MAIN LAYOUT PANELS */}
              <div className="flex-1 flex gap-8 items-center justify-between py-6">
                
                {/* Left Panel: Primary Actions */}
                <div className="w-full max-w-sm flex flex-col gap-4 self-stretch justify-center">
                  {activeTab === 'menu' && (
                    <motion.div
                      initial={{ x: -50, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      className="space-y-4 pointer-events-auto"
                    >
                      {/* Premium Start Quick Race gold gradient button */}
                      <button
                        onClick={handleStartRace}
                        className="group w-full py-4.5 px-6 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:brightness-110 text-slate-950 font-black text-sm uppercase tracking-widest rounded-2xl flex items-center justify-between shadow-[0_4px_25px_rgba(245,158,11,0.35)] transition duration-200"
                      >
                        <span className="flex items-center gap-3">
                          <Play className="w-4 h-4 fill-slate-950" /> START QUICK RACE
                        </span>
                        <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                      </button>

                      {/* Navigation list */}
                      <div className="space-y-2">
                        <button
                          onClick={() => {
                            synthSound('click');
                            setMatchmakingTime(6);
                            setMatchmakingStatus('Connecting to Career server cluster...');
                            setMatchmakingActive(true);
                          }}
                          className={`${glassCardClass} w-full py-3 px-5 hover:bg-white/90 border border-white/60 flex items-center justify-between transition text-left`}
                        >
                          <div className="flex items-center gap-3">
                            <Trophy className="w-5 h-5 text-amber-500" />
                            <div>
                              <div className="font-bold text-xs uppercase text-slate-800">Career Mode</div>
                              <span className="text-[8px] text-slate-500 uppercase font-bold">Championship series</span>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </button>

                        <button
                          onClick={() => {
                            synthSound('click');
                            setMatchmakingTime(8);
                            setMatchmakingStatus('Matching drivers globally...');
                            setMatchmakingActive(true);
                          }}
                          className={`${glassCardClass} w-full py-3 px-5 hover:bg-white/90 border border-white/60 flex items-center justify-between transition text-left`}
                        >
                          <div className="flex items-center gap-3">
                            <Gamepad2 className="w-5 h-5 text-cyan-600" />
                            <div>
                              <div className="font-bold text-xs uppercase text-slate-800">Multiplayer</div>
                              <span className="text-[8px] text-slate-500 uppercase font-bold">Realtime driver lobbies</span>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </button>

                        <button
                          onClick={() => { synthSound('click'); setActiveTab('garage'); }}
                          className={`${glassCardClass} w-full py-3 px-5 hover:bg-white/90 border border-white/60 flex items-center justify-between transition text-left`}
                        >
                          <div className="flex items-center gap-3">
                            <Palette className="w-5 h-5 text-[#00CFFF]" />
                            <div>
                              <div className="font-bold text-xs uppercase text-slate-800">Garage Customizer</div>
                              <span className="text-[8px] text-slate-500 uppercase font-bold">Tune performance & paints</span>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </button>

                        <button
                          onClick={() => { synthSound('click'); setActiveTab('map'); }}
                          className={`${glassCardClass} w-full py-3 px-5 hover:bg-white/90 border border-white/60 flex items-center justify-between transition text-left`}
                        >
                          <div className="flex items-center gap-3">
                            <MapIcon className="w-5 h-5 text-indigo-500" />
                            <div>
                              <div className="font-bold text-xs uppercase text-slate-800">100+ Circuit maps</div>
                              <span className="text-[8px] text-slate-500 uppercase font-bold">Procedural route planner</span>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => { synthSound('click'); setActiveTab('calibration'); }}
                          className="py-2.5 px-3 border border-white/60 bg-white/70 text-slate-700 hover:bg-white rounded-xl flex items-center justify-center gap-1.5 transition text-[10px] font-bold uppercase shadow-sm"
                        >
                          <Sliders className="w-4 h-4 text-amber-500" /> CALIBRATE
                        </button>
                        <button
                          onClick={() => { synthSound('click'); setActiveTab('settings'); }}
                          className="py-2.5 px-3 border border-white/60 bg-white/70 text-slate-700 hover:bg-white rounded-xl flex items-center justify-center gap-1.5 transition text-[10px] font-bold uppercase shadow-sm"
                        >
                          <Settings className="w-4 h-4 text-slate-400" /> SETTINGS
                        </button>
                      </div>

                      <button
                        onClick={() => { synthSound('click'); setShowExitPrompt(true); }}
                        className="w-full py-2 bg-red-100/60 border border-red-500/25 rounded-xl text-center text-red-600 hover:bg-red-500/10 transition font-bold text-xs uppercase tracking-widest"
                      >
                        Exit Game
                      </button>
                    </motion.div>
                  )}

                  {activeTab === 'garage' && (
                    <GarageCustomizer onBack={() => setActiveTab('menu')} />
                  )}

                  {activeTab === 'map' && (
                    <div className="fixed inset-y-0 left-0 w-full max-w-2xl bg-white/95 border-r border-slate-200 p-8 flex flex-col justify-between z-30 pointer-events-auto shadow-2xl text-slate-800">
                      <div className="flex justify-between items-center border-b border-slate-200 pb-4 mb-4">
                        <div>
                          <h2 className="text-base font-extrabold text-[#00CFFF] uppercase tracking-widest flex items-center gap-2">
                            <MapIcon className="w-4 h-4" /> 100+ MAP COLLECTION
                          </h2>
                          <span className="text-[8px] text-slate-400 uppercase mt-0.5">Filter and launch routes</span>
                        </div>
                        <button onClick={() => { synthSound('click'); setActiveTab('menu'); }} className="text-xs uppercase text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                      </div>

                      {/* Search & Difficulty Filter */}
                      <div className="flex gap-3.5 mb-4 text-xs">
                        <input
                          type="text"
                          placeholder="Search track name..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-slate-800 font-mono"
                        />
                        <select
                          value={selectedDifficulty}
                          onChange={(e) => setSelectedDifficulty(e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-mono"
                        >
                          <option value="All">All Difficulties</option>
                          <option value="easy">Easy</option>
                          <option value="medium">Medium</option>
                          <option value="hard">Hard</option>
                          <option value="expert">Expert</option>
                          <option value="nightmare">Nightmare</option>
                        </select>
                      </div>

                      {/* Category tabs list */}
                      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 max-w-full text-[9px] border-b border-slate-200 scrollbar-thin">
                        {['All', 'City', 'Highway', 'Desert', 'Mountain', 'Snow', 'Forest', 'Beach', 'Canyon', 'Volcano', 'Jungle', 'Cyberpunk', 'Space', 'Island'].map((cat) => (
                          <button
                            key={cat}
                            onClick={() => { synthSound('hover'); setSelectedCategory(cat); }}
                            className={`px-3 py-1.5 rounded-lg border uppercase whitespace-nowrap ${
                              selectedCategory === cat 
                                ? 'border-[#00CFFF] bg-[#00CFFF]/10 text-[#00CFFF] font-bold' 
                                : 'border-slate-200 text-slate-400 hover:bg-slate-50'
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>

                      {/* Scrollable list grid of filtered tracks */}
                      <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
                        {tracks
                          .filter((t) => {
                            const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.category.toLowerCase().includes(searchQuery.toLowerCase());
                            const matchesCategory = selectedCategory === 'All' || t.category === selectedCategory;
                            const matchesDifficulty = selectedDifficulty === 'All' || t.difficulty === selectedDifficulty;
                            return matchesSearch && matchesCategory && matchesDifficulty;
                          })
                          .map((tr) => (
                            <div key={tr.id} className="flex justify-between items-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 hover:border-[#00CFFF]/45 transition">
                              <div className="flex flex-col gap-1 text-[10px]">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-800 text-xs">{tr.name}</span>
                                  <span className="px-1.5 py-0.5 bg-slate-200 rounded text-[8px] text-slate-600 uppercase">{tr.category}</span>
                                </div>
                                <span className="text-slate-400">{tr.distance} KM • {tr.terrain} • {tr.weather}</span>
                              </div>

                              <div className="flex items-center gap-3">
                                <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${
                                  tr.difficulty === 'easy' ? 'bg-green-400/10 text-green-600' :
                                  tr.difficulty === 'medium' ? 'bg-cyan-400/10 text-cyan-600' :
                                  tr.difficulty === 'hard' ? 'bg-yellow-400/10 text-yellow-600' :
                                  tr.difficulty === 'expert' ? 'bg-pink-400/10 text-pink-600' : 'bg-red-500/10 text-red-500'
                                }`}>{tr.difficulty}</span>

                                <button
                                  onClick={() => { synthSound('click'); toggleFavorite(tr.id); }}
                                  className="p-1 text-slate-400 hover:text-pink-500"
                                >
                                  <Heart className={`w-4 h-4 ${tr.favorite ? 'fill-pink-500 text-pink-500' : ''}`} />
                                </button>

                                <button
                                  onClick={() => {
                                    synthSound('click');
                                    setTrack(tr.id);
                                    setActiveTab('menu');
                                  }}
                                  className="px-3 py-1.5 bg-[#00CFFF] text-slate-950 font-bold rounded-lg text-[9px] uppercase hover:brightness-110 transition"
                                >
                                  Select
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {activeTab === 'calibration' && (
                    <div className="w-screen max-w-4xl fixed inset-x-0 mx-auto top-24 bg-white/95 p-6 rounded-2xl border border-slate-200 z-40 text-slate-800 shadow-2xl">
                      <div className="flex justify-between items-center mb-4">
                        <h2 className="text-base font-bold uppercase tracking-wider text-[#00CFFF]">Hand Calibration</h2>
                        <button onClick={() => { synthSound('click'); setActiveTab('menu'); }} className="text-xs text-slate-400 hover:text-slate-600 uppercase">Close</button>
                      </div>
                      <GestureCalibrator onComplete={() => {
                        setStatus('countdown');
                        setActiveTab('menu');
                      }} />
                    </div>
                  )}

                  {activeTab === 'leaderboard' && (
                    <div className="bg-white/80 border border-white/60 rounded-2xl p-6 backdrop-blur-md w-full shadow-lg text-slate-800">
                      <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-3">
                        <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                          <Trophy className="w-4 h-4 text-amber-500" /> Standings Records
                        </h2>
                        <button onClick={() => { synthSound('click'); setActiveTab('menu'); }} className="text-xs text-slate-400 hover:text-slate-600 uppercase">Close</button>
                      </div>
                      <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                        {[
                          { username: 'PalmMaster_99', time: '0:54.20' },
                          { username: 'VelocityApe', time: '0:56.90' },
                          { username: 'DriftDemon', time: '0:58.10' },
                          { username: 'AIGestureRacer', time: '0:59.30' }
                        ].map((e, idx) => (
                          <div key={idx} className="flex justify-between items-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
                            <span className="font-bold text-slate-700">#{idx + 1} {e.username}</span>
                            <span className="text-[#00CFFF] font-bold text-xs">{e.time}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === 'settings' && (
                    <div className="bg-white/80 border border-white/60 rounded-2xl p-6 backdrop-blur-md w-full space-y-4 text-xs text-slate-800 shadow-lg">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                        <h2 className="font-bold uppercase tracking-wider">Settings & Themes</h2>
                        <button onClick={() => { synthSound('click'); setActiveTab('menu'); }} className="text-xs text-slate-400 hover:text-slate-600 uppercase">Close</button>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-slate-600">Active Weather:</span>
                        <select
                          value={weather}
                          onChange={(e) => { synthSound('click'); setWeather(e.target.value as GameWeather); }}
                          className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-800 font-mono"
                        >
                          <option value="sunny">Sunny (Dry)</option>
                          <option value="rain">Rain (Wet Slip)</option>
                          <option value="snow">Snow (Sludge Ice)</option>
                          <option value="fog">Fog (Low Visual)</option>
                        </select>
                      </div>

                      <div className="flex justify-between items-center py-1">
                        <span className="text-slate-600">Hand Mode:</span>
                        <div className="flex gap-1 bg-slate-100 p-0.5 rounded border border-slate-200">
                          <button
                            onClick={() => { synthSound('click'); setHandMode('left'); }}
                            className={`px-3 py-1 rounded text-[10px] ${handMode === 'left' ? 'bg-[#00CFFF] text-slate-950 font-bold' : 'text-slate-400'}`}
                          >
                            Left Hand
                          </button>
                          <button
                            onClick={() => { synthSound('click'); setHandMode('right'); }}
                            className={`px-3 py-1 rounded text-[10px] ${handMode === 'right' ? 'bg-[#00CFFF] text-slate-950 font-bold' : 'text-slate-400'}`}
                          >
                            Right Hand
                          </button>
                        </div>
                      </div>

                      <div className="flex justify-between items-center py-1">
                        <span className="text-slate-600">Keyboard Fallback (Dev):</span>
                        <button
                          onClick={() => { synthSound('click'); setDebugKeyboard(!debugKeyboard); }}
                          className={`px-3 py-1 rounded border ${debugKeyboard ? 'border-green-500 text-green-500 font-bold bg-green-50' : 'border-slate-200 text-slate-400'}`}
                        >
                          {debugKeyboard ? 'ON (WASD Allowed)' : 'OFF (Gestures Only)'}
                        </button>
                      </div>

                      <button
                        onClick={() => {
                          synthSound('click');
                          if (confirm('Reset all progress, coins, and records?')) resetProgress();
                        }}
                        className="w-full py-2 bg-red-50 border border-red-200 text-red-600 text-[10px] uppercase font-bold rounded-lg hover:bg-red-100 transition"
                      >
                        Reset Game Stats
                      </button>
                    </div>
                  )}
                </div>

                {/* Right Panel: Driver Telemetry Stats */}
                <div className="w-full max-w-sm flex flex-col gap-3.5 self-stretch justify-center pointer-events-auto">
                  
                  {/* Telemetry Statistics Cards grid */}
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Max Speed */}
                    <div className={glassCardClass}>
                      <span className="text-[8px] font-bold text-[#00CFFF] flex items-center gap-1 uppercase">
                        <Gauge className="w-3.5 h-3.5" /> Best Speed
                      </span>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-lg font-black text-slate-800">342</span>
                        <span className="text-[8px] text-slate-400">KM/H</span>
                      </div>
                    </div>

                    {/* Wins count */}
                    <div className={glassCardClass}>
                      <span className="text-[8px] font-bold text-amber-500 flex items-center gap-1 uppercase">
                        <Award className="w-3.5 h-3.5" /> Total Wins
                      </span>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-lg font-black text-slate-800">12</span>
                        <span className="text-[8px] text-slate-400">GOLD CAPS</span>
                      </div>
                    </div>

                    {/* Drift Score */}
                    <div className={glassCardClass}>
                      <span className="text-[8px] font-bold text-[#00CFFF] flex items-center gap-1 uppercase">
                        <Flame className="w-3.5 h-3.5" /> Drift Score
                      </span>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-lg font-black text-slate-800">9,450</span>
                        <span className="text-[8px] text-slate-400">PTS</span>
                      </div>
                    </div>

                    {/* Accuracy score */}
                    <div className={glassCardClass}>
                      <span className="text-[8px] font-bold text-amber-500 flex items-center gap-1 uppercase">
                        <Activity className="w-3.5 h-3.5" /> Gesture Acc
                      </span>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-lg font-black text-slate-800">94.2</span>
                        <span className="text-[8px] text-slate-400">%</span>
                      </div>
                    </div>
                  </div>

                  {/* Camera Connection Status Panel */}
                  <div className={glassCardClass}>
                    <span className="text-[8px] font-bold text-[#00CFFF] block uppercase">Live Camera Diagnostics</span>
                    <div className="flex justify-between items-center text-[10px] mt-1.5">
                      <span className="text-slate-500">Connection:</span>
                      <span className={`font-bold flex items-center gap-1 ${cameraPermission === 'granted' ? 'text-green-600 font-black' : 'text-red-500 font-black'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cameraPermission === 'granted' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                        {cameraPermission === 'granted' ? 'CONNECTED' : 'DISCONNECTED'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-slate-500">Hand Landmarks:</span>
                      <span className={`font-bold ${handDetected ? 'text-green-600 font-black' : 'text-slate-400'}`}>
                        {handDetected ? 'ACTIVE (2 HANDS)' : 'SEARCHING...'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-slate-500">Tracking Speed:</span>
                      <span className="font-bold text-[#00CFFF]">{webcamFps} FPS</span>
                    </div>
                  </div>

                  {/* Selected Map Preview Card */}
                  <div className={glassCardClass}>
                    <div className="flex justify-between items-center border-b border-slate-100 pb-1.5 mb-2">
                      <span className="text-[8px] font-bold text-amber-500 uppercase flex items-center gap-1"><MapIcon className="w-3 h-3" /> Active Circuit</span>
                      <button onClick={() => setActiveTab('map')} className="text-[8px] text-[#00CFFF] hover:underline uppercase font-bold">Change Route</button>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center font-black text-slate-400 border border-slate-200">
                        {selectedTrackData.category.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 flex flex-col gap-0.5 text-[10px]">
                        <span className="font-black text-slate-800 text-xs">{selectedTrackData.name}</span>
                        <span className="text-slate-400 uppercase">{selectedTrackData.distance} KM • {selectedTrackData.weather} • {selectedTrackData.difficulty}</span>
                      </div>
                    </div>
                  </div>

                  {/* Daily Missions */}
                  <div className={glassCardClass}>
                    <span className="text-[8px] font-bold text-[#00CFFF] block uppercase border-b border-slate-100 pb-1.5">Daily Missions</span>
                    <div className="space-y-3 mt-3">
                      {dailyChallenges.map((ch) => (
                        <div key={ch.id} className="flex flex-col gap-1.5 text-[9px]">
                          <div className="flex justify-between items-center">
                            <span className={ch.completed ? 'line-through text-slate-400' : 'font-bold text-slate-700'}>{ch.name}</span>
                            <span className="text-[#00CFFF] font-bold">+{ch.reward} Coins</span>
                          </div>
                          <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                            <div 
                              className={`h-full ${ch.completed ? 'bg-green-500' : 'bg-[#00CFFF]'}`} 
                              style={{ width: `${Math.min(100, (ch.current / ch.target) * 100)}%` }} 
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

              </div>

              {/* 3. FOOTER */}
              <div className="w-full border-t border-slate-200 pt-4 flex justify-between items-center text-[9px] uppercase tracking-widest text-slate-400">
                <span>PalmPivot Racing Simulator</span>
                <div className="flex gap-6 pointer-events-auto font-bold text-[#00CFFF]">
                  {savedPhotos.length > 0 && (
                    <button 
                      onClick={() => { synthSound('click'); setShowGallery(true); }}
                      className="hover:underline flex items-center gap-1"
                    >
                      <Image className="w-3 h-3" /> SNAPSHOT GALLERY ({savedPhotos.length})
                    </button>
                  )}
                  <span>Tokyo Highway Circuit</span>
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Camera Access Blocker Screen */}
      {triggerCameraPrompt && (
        <div className="absolute inset-0 bg-slate-950/85 z-50 flex items-center justify-center p-6 pointer-events-auto">
          <div className="bg-white/95 border border-slate-200 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl flex flex-col items-center">
            <Camera className="w-16 h-16 text-[#00CFFF] mb-4 animate-pulse" />
            <h2 className="text-xl font-extrabold uppercase text-slate-800 tracking-wider mb-2">Camera Access Required</h2>
            <p className="text-slate-500 text-xs mb-6 leading-relaxed">
              This game is controlled entirely through Hand Gestures. Please allow camera permission to continue.
            </p>

            <div className="flex flex-col gap-2.5 w-full">
              <button
                onClick={() => {
                  console.log('Enable Camera button clicked');
                  setTriggerCameraPrompt(false);
                  setTimeout(() => {
                    setTriggerCameraPrompt(true);
                  }, 100);
                }}
                className="w-full py-3 bg-[#00CFFF] text-slate-950 font-bold text-xs uppercase tracking-widest rounded-xl transition shadow-[0_4px_15px_rgba(0,207,255,0.2)] active:scale-95 duration-100"
              >
                Enable Camera
              </button>
              
              <button
                onClick={() => {
                  console.log('Retry button clicked');
                  setTriggerCameraPrompt(false);
                  setTimeout(() => {
                    setTriggerCameraPrompt(true);
                  }, 100);
                }}
                className="w-full py-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs uppercase tracking-wider rounded-xl transition active:scale-95 duration-100"
              >
                Retry
              </button>

              <button
                onClick={() => {
                  setTriggerCameraPrompt(false);
                }}
                className="text-[9px] text-slate-400 uppercase mt-4 hover:text-slate-600 transition active:scale-95 duration-100"
              >
                Cancel & Return
              </button>
            </div>
          </div>

          <div className="absolute opacity-0 pointer-events-none w-px h-px overflow-hidden z-0">
            <WebcamDetector />
          </div>
        </div>
      )}

      {/* Snapshot Gallery Modal */}
      {showGallery && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col justify-between p-8 font-mono pointer-events-auto text-slate-800">
          <div className="w-full flex justify-between items-center border-b border-slate-200 pb-4">
            <h2 className="text-lg font-black uppercase text-[#00CFFF] flex items-center gap-2">
              <Image className="w-5 h-5" /> In-Game Photo Gallery
            </h2>
            <button 
              onClick={() => { synthSound('click'); setShowGallery(false); }}
              className="text-xs uppercase text-slate-500 hover:text-slate-800 border border-slate-200 px-3 py-1 rounded-lg hover:border-slate-400 transition"
            >
              Back To Menu
            </button>
          </div>

          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 items-center justify-center py-6 overflow-y-auto">
            {savedPhotos.map((url, idx) => (
              <div key={idx} className="relative aspect-video rounded-xl border border-slate-200 overflow-hidden shadow-lg group">
                <img src={url} className="w-full h-full object-cover" alt="Race Snap" />
                <button
                  onClick={() => {
                    const filtered = savedPhotos.filter((_, i) => i !== idx);
                    setSavedPhotos(filtered);
                    localStorage.setItem('palmpivot_photos', JSON.stringify(filtered));
                  }}
                  className="absolute top-2 right-2 bg-red-600 text-white font-bold p-1 rounded hover:bg-red-500 text-[8px] uppercase tracking-wider"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exit Game Prompt modal */}
      {showExitPrompt && (
        <div className="fixed inset-0 bg-slate-950/85 z-50 flex items-center justify-center p-6 pointer-events-auto">
          <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center text-slate-850">
            <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4 animate-bounce" />
            <h2 className="text-lg font-black uppercase text-slate-800 tracking-wider mb-2">Exit Simulator?</h2>
            <p className="text-slate-500 text-xs mb-6 leading-relaxed">
              Are you sure you want to exit? Your profile progress is saved automatically.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  synthSound('click');
                  setShowExitPrompt(false);
                  alert('Thank you for playing PalmPivot Racing!');
                }}
                className="py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase rounded-xl transition"
              >
                Yes, Exit
              </button>
              <button
                onClick={() => { synthSound('click'); setShowExitPrompt(false); }}
                className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase rounded-xl transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multiplayer Matchmaking Mock Queue overlay */}
      {matchmakingActive && (
        <div className="fixed inset-0 bg-slate-950/90 z-50 flex items-center justify-center p-6 pointer-events-auto">
          <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl flex flex-col items-center gap-4 text-slate-800">
            <Gamepad2 className="w-16 h-16 text-[#00CFFF] animate-spin" style={{ animationDuration: '3s' }} />
            <h3 className="text-lg font-black uppercase tracking-wider text-slate-850">Matchmaking Lobby</h3>
            <p className="text-slate-500 text-xs leading-relaxed max-w-xs">{matchmakingStatus}</p>
            
            <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 flex justify-between items-center text-xs mt-3">
              <span>Estimated Wait Time:</span>
              <span className="font-bold text-[#00CFFF]">{matchmakingTime}s</span>
            </div>

            <button
              onClick={() => { synthSound('click'); setMatchmakingActive(false); }}
              className="px-6 py-2 bg-slate-100 text-slate-700 border border-slate-200 font-bold text-[10px] uppercase rounded-lg hover:bg-slate-200 transition mt-2"
            >
              Cancel Search
            </button>
          </div>
        </div>
      )}

      {/* 4. RACE START COUNTDOWN OVERLAY */}
      {status === 'countdown' && (
        <div className="absolute inset-0 z-45 flex items-center justify-center bg-black/35 backdrop-blur-sm pointer-events-none">
          <motion.div
            key={countdownNumber}
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1.2, opacity: 1 }}
            exit={{ scale: 1.8, opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="flex flex-col items-center justify-center"
          >
            <span className={`text-[120px] font-black italic tracking-widest filter drop-shadow-[0_0_20px_rgba(255,255,255,0.8)] ${
              countdownNumber === 'GO!' ? 'text-green-400' : 'text-white'
            }`}>
              {countdownNumber}
            </span>
            <span className="text-white/60 text-xs font-mono tracking-widest uppercase mt-4">
              {countdownNumber === 'GO!' ? 'Race Active' : 'Align Steering Wheel'}
            </span>
          </motion.div>
        </div>
      )}

      {/* 2. ARCADE PAUSE OVERLAY */}
      {status === 'paused' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-md">
          <div className="w-96 bg-white/90 border border-white/60 p-8 rounded-3xl shadow-[0_0_50px_rgba(255,255,255,0.15)] flex flex-col gap-6 text-slate-800 text-center font-mono">
            <div>
              <span className="text-xs font-black tracking-widest text-[#00CFFF]">PALMPIVOT RACING</span>
              <h2 className="text-3xl font-black italic tracking-wide text-slate-800 mt-1">RACE PAUSED</h2>
            </div>
            
            <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl text-xs flex flex-col gap-2.5 text-left">
              <div className="flex justify-between">
                <span className="text-slate-400">CIRCUIT:</span>
                <span className="font-bold uppercase">{selectedTrackData?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">SCORE ACCUMULATED:</span>
                <span className="font-bold text-yellow-500">{score} PTS</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">COINS COLLECTED:</span>
                <span className="font-bold text-amber-600">🪙 {coinsCollected}</span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => { synthSound('click'); setStatus('playing'); }}
                className="w-full py-3.5 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-500 hover:to-yellow-600 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition active:scale-95 cursor-pointer"
              >
                Resume Race
              </button>
              <button
                onClick={() => { synthSound('click'); resetRaceStats(); setStatus('countdown'); }}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition active:scale-95 cursor-pointer"
              >
                Restart Race
              </button>
              <button
                onClick={() => { synthSound('click'); setStatus('menu'); }}
                className="w-full py-3 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 font-bold text-xs uppercase tracking-wider rounded-xl transition active:scale-95 cursor-pointer"
              >
                Quit to Main Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. ARCADE GAME OVER OVERLAY */}
      {status === 'gameover' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md">
          <div className="w-104 bg-white/90 border border-white/60 p-8 rounded-3xl shadow-[0_0_50px_rgba(255,255,255,0.15)] flex flex-col gap-6 text-slate-800 text-center font-mono">
            <div>
              <span className="text-xs font-black tracking-widest text-[#00CFFF]">PALMPIVOT RACING</span>
              <h2 className={`text-3xl font-black italic tracking-wide mt-1 uppercase ${
                health <= 0 
                  ? 'text-red-600' 
                  : fuel <= 0 
                    ? 'text-orange-500' 
                    : 'text-green-600'
              }`}>
                {health <= 0 
                  ? 'VEHICLE DESTROYED' 
                  : fuel <= 0 
                    ? 'ENGINE OUT OF FUEL' 
                    : 'RACE COMPLETED!'}
              </h2>
            </div>
            
            <div className="bg-slate-50 border border-slate-200/60 p-5 rounded-2xl flex flex-col gap-3 text-left">
              <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                <span className="text-slate-400 text-xs">CIRCUIT:</span>
                <span className="font-extrabold text-sm uppercase">{selectedTrackData?.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-xs">FINAL SCORE:</span>
                <span className="font-black text-2xl text-yellow-500 tracking-wider">{score}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-xs">COINS COLLECTED:</span>
                <span className="font-black text-xl text-amber-600">🪙 {coinsCollected}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-xs">DISTANCE COVERED:</span>
                <span className="font-bold text-slate-800">{distance}m</span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-200/60 pt-2 text-[10px]">
                <span className="text-slate-400">DIAMONDS EARNED:</span>
                <span className="font-extrabold text-cyan-500">
                  {score > 10000 ? '💎 +2 Diamonds' : score > 5000 ? '💎 +1 Diamond' : '💎 +0'}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  synthSound('click');
                  // Award profile diamonds if they earned them
                  if (score > 10000) useGameStore.getState().addDiamonds(2);
                  else if (score > 5000) useGameStore.getState().addDiamonds(1);
                  resetRaceStats();
                  setStatus('countdown');
                }}
                className="w-full py-4 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-500 hover:to-yellow-600 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition active:scale-95 cursor-pointer"
              >
                Play Again / Retry
              </button>
              <button
                onClick={() => {
                  synthSound('click');
                  if (score > 10000) useGameStore.getState().addDiamonds(2);
                  else if (score > 5000) useGameStore.getState().addDiamonds(1);
                  setStatus('garage');
                }}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition active:scale-95 cursor-pointer"
              >
                Return to Garage
              </button>
              <button
                onClick={() => {
                  synthSound('click');
                  if (score > 10000) useGameStore.getState().addDiamonds(2);
                  else if (score > 5000) useGameStore.getState().addDiamonds(1);
                  setStatus('menu');
                }}
                className="w-full py-3 bg-slate-100 hover:bg-red-50 hover:border-red-200 text-slate-600 font-bold text-xs uppercase tracking-wider rounded-xl transition active:scale-95 cursor-pointer"
              >
                Back to Main Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gameplay HUD & R3F Active Race Canvas */}
      {/* IMPORTANT: Canvas is always mounted to prevent WebGL context loss on status change */}
      {/* Visibility is controlled via CSS, not conditional rendering */}
      <div
        className="absolute inset-0"
        style={{
          display: (status === 'playing' || status === 'countdown' || status === 'paused' || status === 'gameover') ? 'block' : 'none',
          width: '100vw',
          height: '100vh',
        }}
      >
        {(status === 'playing' || status === 'countdown' || status === 'paused' || status === 'gameover') && (
        <div className="w-full h-full relative" style={{ width: '100vw', height: '100vh' }}>
          
          <div
            className="w-full h-full transition duration-300"
            style={{
              width: '100%',
              height: '100%',
              filter: activeFilter === 'cyberpunk' ? 'hue-rotate(60deg) saturate(200%)' :
                      activeFilter === 'vintage' ? 'sepia(100%) contrast(125%)' :
                      activeFilter === 'monochrome' ? 'grayscale(100%) contrast(150%)' : 'none',
            }}
          >
            <GameCanvas />
          </div>

          {!photoModeActive && <HUD />}

          {!photoModeActive && (
            <div className="absolute top-6 right-6 w-52 overflow-hidden pointer-events-auto border-2 border-[#00CFFF]/45 rounded-2xl shadow-[0_0_15px_rgba(0,207,255,0.15)] z-20 bg-white/60 backdrop-blur-md">
              <WebcamDetector />
            </div>
          )}

          {/* Shutter controls overlay for Photo Mode */}
          {photoModeActive && (
            <div className="absolute inset-0 z-30 pointer-events-none flex flex-col justify-between p-8 border-4 border-dashed border-white/40">
              <div className="w-full flex justify-between items-start pointer-events-auto">
                <div className="bg-white/90 p-4 rounded-xl border border-slate-200 flex flex-col gap-1.5 text-[10px] text-slate-800 shadow-md">
                  <span className="text-slate-400 uppercase tracking-widest font-bold">DSLR FILTER PRESET</span>
                  <div className="flex gap-2">
                    {['none', 'cyberpunk', 'vintage', 'monochrome'].map((f) => (
                      <button
                        key={f}
                        onClick={() => setActiveFilter(f as any)}
                        className={`px-2.5 py-1 rounded border uppercase ${
                          activeFilter === f ? 'border-[#00CFFF] text-[#00CFFF] font-bold bg-[#00CFFF]/10' : 'border-slate-200 text-slate-400 hover:bg-slate-50'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setPhotoModeActive(false);
                    setActiveFilter('none');
                  }}
                  className="px-4 py-2 border border-slate-200 hover:border-slate-400 rounded-lg bg-white text-xs font-bold uppercase transition pointer-events-auto shadow-sm text-slate-700"
                >
                  Exit Shutter Mode
                </button>
              </div>

              <div className="self-center w-24 h-24 rounded-full border border-[#00CFFF]/30 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-[#00CFFF]" />
              </div>

              <div className="w-full flex justify-center pointer-events-auto">
                <button
                  onClick={() => {
                    const canvas = document.querySelector('canvas');
                    if (canvas) {
                      try {
                        const url = canvas.toDataURL('image/png');
                        const updated = [url, ...savedPhotos].slice(0, 12);
                        setSavedPhotos(updated);
                        localStorage.setItem('palmpivot_photos', JSON.stringify(updated));
                        alert('📷 Photo captured and saved to your Local Gallery!');
                      } catch (e) {
                        console.warn('Failed to snapshot WebGL context:', e);
                      }
                    }
                  }}
                  className="flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition transform active:scale-95"
                >
                  <Camera className="w-4 h-4 fill-slate-950" /> Take Snapshot
                </button>
              </div>
            </div>
          )}

          {/* Escape / Pause / Shutter triggers */}
          {status === 'playing' && (
            <div className="absolute top-6 left-6 pointer-events-auto flex gap-3.5 z-20">
              <button
                onClick={() => setStatus('menu')}
                className="px-4 py-2 border border-slate-200 hover:bg-red-50 hover:border-red-300 bg-white/90 backdrop-blur-md rounded-xl text-[10px] font-bold uppercase transition text-red-600 shadow-lg"
              >
                Quit Race
              </button>
              <button
                onClick={() => setStatus('paused')}
                className="px-4 py-2 border border-slate-200 hover:bg-sky-50 hover:border-sky-300 bg-white/90 backdrop-blur-md rounded-xl text-[10px] font-bold uppercase transition text-[#00CFFF] shadow-lg"
              >
                Pause
              </button>
              {!photoModeActive && (
                <button
                  onClick={() => setPhotoModeActive(true)}
                  className="px-4 py-2 border border-slate-200 hover:bg-sky-50 hover:border-sky-300 bg-white/90 backdrop-blur-md rounded-xl text-[10px] font-bold uppercase transition text-[#00CFFF] shadow-lg flex items-center gap-1.5"
                >
                  <Camera className="w-3.5 h-3.5" /> Photo Mode
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>

    </main>
  );
}

"use client";

import React, { useState } from "react";
import { playBeep, playCoin } from "@/utils/audio";
import { SQUAD_NAMES } from "@/constants/players";

interface PlayerInputProps {
  names: string[];
  onChange: (names: string[]) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}


export default function PlayerInput({ names, onChange, onGenerate, isGenerating }: PlayerInputProps) {
  const [inputText, setInputText] = useState(names.join(", "));
  
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setInputText(text);
    
    const parsedNames = text
      .split(/[,\s]+/)
      .map(n => n.trim())
      .filter(n => n.length > 0);
      
    onChange(parsedNames);
  };

  const handlePrefill = (preset: string[]) => {
    playCoin();
    setInputText(preset.join(", "));
    onChange(preset);
  };

  const handleClear = () => {
    playBeep(220, 0.1, "sawtooth");
    setInputText("");
    onChange([]);
  };

  const currentCount = names.length;
  const isReady = currentCount >= 10;

  return (
    <div className="flex flex-col bg-bg-cabinet border-4 border-slate-700/80 p-6 shadow-2xl relative overflow-hidden transition-all duration-300">
      {/* Decorative metal rivets/screws */}
      <div className="absolute top-2 left-2 w-2.5 h-2.5 rounded-full bg-slate-600 border border-black shadow-inner opacity-70" />
      <div className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-slate-600 border border-black shadow-inner opacity-70" />
      <div className="absolute bottom-2 left-2 w-2.5 h-2.5 rounded-full bg-slate-600 border border-black shadow-inner opacity-70" />
      <div className="absolute bottom-2 right-2 w-2.5 h-2.5 rounded-full bg-slate-600 border border-black shadow-inner opacity-70" />

      {/* Screen Title */}
      <div className="flex items-center justify-between border-b-4 border-slate-700 pb-3.5 mb-4">
        <h2 className="text-sm font-bold tracking-widest text-neon-yellow uppercase font-pixel glow-yellow">
          SELECT FIGHTERS
        </h2>
        <span 
          className={`font-pixel text-[10px] px-2.5 py-0.5 border-2 transition-all duration-300 ${
            isReady ? "border-neon-blue text-neon-blue glow-blue" : "border-neon-red text-neon-red glow-red"
          }`}
        >
          DRAFT: {currentCount}/10
        </span>
      </div>

      {/* Instructions */}
      <p className="text-[11px] text-[#a0a0c0] uppercase tracking-wider mb-4 leading-relaxed font-mono">
        ENTER FIGHTER NAMES (SEPARATED BY COMMAS OR SPACES). WE RECOMMEND 10 NAMES FOR A BALANCED 5v5 MATCH. EXTRA SLOTS WILL BE AUTO-FILLED.
      </p>

      {/* Multi-line Roster Roster */}
      <textarea
        className="w-full h-44 bg-black/60 border-2 border-slate-700 p-3 text-sm text-white font-mono tracking-wide focus:border-neon-yellow focus:outline-none transition-all duration-200 shadow-inner resize-none uppercase focus:ring-1 focus:ring-neon-yellow"
        placeholder="ENTER FIGHTERS HERE...&#10;e.g.&#10;james, kevin, jinny, lark&#10;or&#10;james kevin jinny lark"
        value={inputText}
        onChange={handleTextChange}
        disabled={isGenerating}
      />

      {/* Preset / Action buttons */}
      <div className="grid grid-cols-2 gap-2 mt-4 font-pixel">
        {/* <button
          type="button"
          onClick={() => handlePrefill(PRESET_CHAMPIONS)}
          className="text-[9px] text-[#a0a0c0] bg-transparent border-2 border-slate-600 py-2.5 cursor-pointer shadow-[0_3px_0_#121214] hover:border-white hover:text-white active:translate-y-0.5 active:shadow-none transition-all transform -translate-y-0.5 uppercase tracking-tighter"
          disabled={isGenerating}
        >
          MLBB HEROES
        </button> */}
        {/* <button
          type="button"
          onClick={() => handlePrefill(PRESET_PROS)}
          className="text-[9px] text-[#a0a0c0] bg-transparent border-2 border-slate-600 py-2.5 cursor-pointer shadow-[0_3px_0_#121214] hover:border-white hover:text-white active:translate-y-0.5 active:shadow-none transition-all transform -translate-y-0.5 uppercase tracking-tighter"
          disabled={isGenerating}
        >
          PRO LEAGUE
        </button> */}
        <button
          type="button"
          onClick={() => handlePrefill(SQUAD_NAMES)}
          className="text-[9px] text-neon-blue bg-transparent border-2 border-neon-blue/40 py-2.5 cursor-pointer shadow-[0_3px_0_#121214] hover:border-neon-blue hover:text-white active:translate-y-0.5 active:shadow-none transition-all transform -translate-y-0.5 uppercase tracking-tighter"
          disabled={isGenerating}
        >
          Quik fill
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="text-[9px] text-neon-red/80 bg-transparent border-2 border-neon-red/40 py-2.5 cursor-pointer shadow-[0_3px_0_#121214] hover:border-neon-red hover:text-neon-red active:translate-y-0.5 active:shadow-none transition-all transform -translate-y-0.5 uppercase tracking-tighter"
          disabled={isGenerating}
        >
          CLEAR ALL
        </button>
      </div>

      {/* Submit Button */}
      <div className="mt-6 flex flex-col items-center">
        {!isReady && currentCount > 0 && (
          <div className="text-[9px] text-neon-red font-pixel mb-3 uppercase animate-pulse">
            ⚠️ WARNING: SHORT DRAFT ({currentCount}/10). SHIELD BOTS WILL JOIN!
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            playBeep(880, 0.15, "sawtooth");
            onGenerate();
          }}
          disabled={isGenerating}
          className="font-pixel text-xs text-black bg-neon-yellow border-4 border-white px-6 py-3 cursor-pointer shadow-[0_0_0_4px_#121214,0_6px_0_#121214,0_8px_15px_rgba(255,210,0,0.3)] hover:bg-white hover:shadow-[0_0_0_4px_#121214,0_6px_0_#121214,0_8px_20px_rgba(255,255,255,0.4)] active:translate-y-1 active:shadow-[0_0_0_4px_#121214,0_0_0_#121214] transition-all transform -translate-y-1 uppercase font-bold tracking-wide w-full max-w-xs cursor-pointer select-none"
        >
          {isGenerating ? "DRAFTING..." : "FIGHT! RANDOMIZE"}
        </button>
      </div>
    </div>
  );
}

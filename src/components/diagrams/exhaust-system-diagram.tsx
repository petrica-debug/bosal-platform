"use client";

/**
 * Professional SVG diagram of a heavy-duty diesel aftertreatment system.
 * Presentation-grade — Siemens/Bosch engineering aesthetic.
 */
export function ExhaustSystemDiagram({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1100 380"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Gradients */}
        <linearGradient id="pipeGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6B7D8E" />
          <stop offset="50%" stopColor="#8FA3B3" />
          <stop offset="100%" stopColor="#6B7D8E" />
        </linearGradient>
        <linearGradient id="catalystGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2D6A8A" />
          <stop offset="40%" stopColor="#1A4F6E" />
          <stop offset="100%" stopColor="#0F3652" />
        </linearGradient>
        <linearGradient id="dpfGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7A5C3A" />
          <stop offset="40%" stopColor="#5C4028" />
          <stop offset="100%" stopColor="#3E2A1A" />
        </linearGradient>
        <linearGradient id="scrGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2A7A5A" />
          <stop offset="40%" stopColor="#1A5E42" />
          <stop offset="100%" stopColor="#0F4030" />
        </linearGradient>
        <linearGradient id="ascGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6A4A8A" />
          <stop offset="40%" stopColor="#4E356E" />
          <stop offset="100%" stopColor="#352452" />
        </linearGradient>
        <linearGradient id="engineGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3A3A4A" />
          <stop offset="100%" stopColor="#1E1E2A" />
        </linearGradient>
        <linearGradient id="heatGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#E63946" />
          <stop offset="50%" stopColor="#E6A23C" />
          <stop offset="100%" stopColor="#2A9D8F" />
        </linearGradient>
        <linearGradient id="defGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4ECDC4" />
          <stop offset="100%" stopColor="#2A9D8F" />
        </linearGradient>
        {/* Filters */}
        <filter id="shadow" x="-4%" y="-4%" width="108%" height="112%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15" />
        </filter>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Honeycomb pattern for catalyst face */}
        <pattern id="honeycomb" x="0" y="0" width="8" height="7" patternUnits="userSpaceOnUse">
          <rect width="8" height="7" fill="none" />
          <circle cx="2" cy="2" r="1.2" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.4" />
          <circle cx="6" cy="2" r="1.2" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.4" />
          <circle cx="4" cy="5.5" r="1.2" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.4" />
        </pattern>
      </defs>

      {/* Background */}
      <rect width="1100" height="380" rx="8" fill="white" />

      {/* Title bar */}
      <text x="550" y="28" textAnchor="middle" fill="#1A4F6E" fontSize="15" fontWeight="700" fontFamily="system-ui, sans-serif" letterSpacing="0.05em">
        HEAVY-DUTY DIESEL AFTERTREATMENT SYSTEM
      </text>
      <line x1="200" y1="36" x2="900" y2="36" stroke="#1A4F6E" strokeWidth="0.5" opacity="0.4" />

      {/* Temperature gradient bar */}
      <rect x="200" y="340" width="700" height="6" rx="3" fill="url(#heatGrad)" opacity="0.7" />
      <text x="200" y="360" fill="#E63946" fontSize="9" fontFamily="system-ui" fontWeight="600">450°C</text>
      <text x="550" y="360" textAnchor="middle" fill="#E6A23C" fontSize="9" fontFamily="system-ui" fontWeight="600">350°C</text>
      <text x="900" y="360" textAnchor="end" fill="#2A9D8F" fontSize="9" fontFamily="system-ui" fontWeight="600">200°C</text>
      <text x="550" y="375" textAnchor="middle" fill="#6B7D8E" fontSize="8" fontFamily="system-ui">EXHAUST GAS TEMPERATURE PROFILE</text>

      {/* ===== ENGINE ===== */}
      <g transform="translate(40, 100)" filter="url(#shadow)">
        <rect width="100" height="140" rx="8" fill="url(#engineGrad)" />
        <rect x="5" y="5" width="90" height="130" rx="5" fill="none" stroke="#555" strokeWidth="0.5" />
        {/* Cylinder lines */}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <g key={i}>
            <rect x="15" y={15 + i * 20} width="70" height="14" rx="2" fill="none" stroke="#4A4A5A" strokeWidth="0.8" />
            <line x1="50" y1={15 + i * 20} x2="50" y2={29 + i * 20} stroke="#4A4A5A" strokeWidth="0.5" />
          </g>
        ))}
        <text x="50" y="-8" textAnchor="middle" fill="#1A4F6E" fontSize="11" fontWeight="700" fontFamily="system-ui">ENGINE</text>
        <text x="50" y="-20" textAnchor="middle" fill="#6B7D8E" fontSize="8" fontFamily="system-ui">6-Cylinder Diesel</text>
      </g>

      {/* Turbo outlet pipe */}
      <rect x="140" y="155" width="50" height="30" rx="2" fill="url(#pipeGrad)" />
      <text x="165" y="148" textAnchor="middle" fill="#E63946" fontSize="8" fontWeight="600" fontFamily="system-ui">450°C</text>

      {/* ===== DOC ===== */}
      <g transform="translate(195, 110)" filter="url(#shadow)">
        <rect width="100" height="120" rx="6" fill="url(#catalystGrad)" />
        <rect width="100" height="120" rx="6" fill="url(#honeycomb)" />
        {/* Inlet face */}
        <ellipse cx="0" cy="60" rx="8" ry="50" fill="#1A4F6E" stroke="#2D6A8A" strokeWidth="1" />
        {/* Outlet face */}
        <ellipse cx="100" cy="60" rx="8" ry="50" fill="#1A4F6E" stroke="#2D6A8A" strokeWidth="1" />
        {/* Label */}
        <text x="50" y="55" textAnchor="middle" fill="white" fontSize="16" fontWeight="800" fontFamily="system-ui">DOC</text>
        <text x="50" y="72" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="7" fontFamily="system-ui">Pt-Pd / Al₂O₃</text>
        <text x="50" y="84" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="7" fontFamily="system-ui">400 cpsi / 4 mil</text>
        {/* Conversion arrows */}
        <text x="50" y="-8" textAnchor="middle" fill="#1A4F6E" fontSize="10" fontWeight="700" fontFamily="system-ui">DOC</text>
        <text x="50" y="-20" textAnchor="middle" fill="#6B7D8E" fontSize="7" fontFamily="system-ui">Diesel Oxidation Catalyst</text>
      </g>

      {/* Pipe DOC → DPF */}
      <rect x="303" y="155" width="35" height="30" rx="2" fill="url(#pipeGrad)" />
      <text x="320" y="148" textAnchor="middle" fill="#E6A23C" fontSize="8" fontWeight="600" fontFamily="system-ui">420°C</text>

      {/* ===== DPF ===== */}
      <g transform="translate(343, 105)" filter="url(#shadow)">
        <rect width="110" height="130" rx="6" fill="url(#dpfGrad)" />
        {/* Wall-flow pattern */}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <g key={i}>
            <line x1="15" y1={15 + i * 14} x2="95" y2={15 + i * 14} stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
            {i % 2 === 0 ? (
              <polygon points={`15,${12 + i * 14} 20,${15 + i * 14} 15,${18 + i * 14}`} fill="rgba(255,255,255,0.2)" />
            ) : (
              <polygon points={`95,${12 + i * 14} 90,${15 + i * 14} 95,${18 + i * 14}`} fill="rgba(255,255,255,0.2)" />
            )}
          </g>
        ))}
        <ellipse cx="0" cy="65" rx="8" ry="55" fill="#3E2A1A" stroke="#5C4028" strokeWidth="1" />
        <ellipse cx="110" cy="65" rx="8" ry="55" fill="#3E2A1A" stroke="#5C4028" strokeWidth="1" />
        <text x="55" y="60" textAnchor="middle" fill="white" fontSize="16" fontWeight="800" fontFamily="system-ui">DPF</text>
        <text x="55" y="77" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="7" fontFamily="system-ui">SiC Wall-Flow</text>
        <text x="55" y="89" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="7" fontFamily="system-ui">200 cpsi / 8 mil</text>
        <text x="55" y="-8" textAnchor="middle" fill="#5C4028" fontSize="10" fontWeight="700" fontFamily="system-ui">DPF</text>
        <text x="55" y="-20" textAnchor="middle" fill="#6B7D8E" fontSize="7" fontFamily="system-ui">Diesel Particulate Filter</text>
      </g>

      {/* Pipe DPF → Mixer */}
      <rect x="461" y="155" width="55" height="30" rx="2" fill="url(#pipeGrad)" />
      <text x="488" y="148" textAnchor="middle" fill="#E6A23C" fontSize="8" fontWeight="600" fontFamily="system-ui">380°C</text>

      {/* ===== DEF INJECTION ===== */}
      <g transform="translate(475, 60)">
        {/* DEF tank */}
        <rect x="-15" y="-45" width="40" height="35" rx="4" fill="url(#defGrad)" filter="url(#shadow)" />
        <text x="5" y="-22" textAnchor="middle" fill="white" fontSize="7" fontWeight="700" fontFamily="system-ui">DEF</text>
        <text x="5" y="-13" textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="6" fontFamily="system-ui">AdBlue</text>
        {/* Injection line */}
        <line x1="5" y1="-10" x2="5" y2="85" stroke="#4ECDC4" strokeWidth="2" strokeDasharray="4 2" />
        {/* Injector nozzle */}
        <polygon points="-3,85 13,85 5,95" fill="#4ECDC4" />
        {/* Spray cone */}
        <path d="M 5 95 L -15 115 L 25 115 Z" fill="#4ECDC4" opacity="0.15" />
        <path d="M 5 95 L -10 110 L 20 110 Z" fill="#4ECDC4" opacity="0.1" />
        <text x="30" y="70" fill="#2A9D8F" fontSize="7" fontWeight="600" fontFamily="system-ui">Urea</text>
        <text x="30" y="80" fill="#2A9D8F" fontSize="7" fontFamily="system-ui">Injection</text>
      </g>

      {/* ===== SCR ===== */}
      <g transform="translate(525, 100)" filter="url(#shadow)">
        <rect width="130" height="140" rx="6" fill="url(#scrGrad)" />
        <rect width="130" height="140" rx="6" fill="url(#honeycomb)" />
        <ellipse cx="0" cy="70" rx="8" ry="60" fill="#0F4030" stroke="#1A5E42" strokeWidth="1" />
        <ellipse cx="130" cy="70" rx="8" ry="60" fill="#0F4030" stroke="#1A5E42" strokeWidth="1" />
        <text x="65" y="65" textAnchor="middle" fill="white" fontSize="16" fontWeight="800" fontFamily="system-ui">SCR</text>
        <text x="65" y="82" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="7" fontFamily="system-ui">Cu-SSZ-13 Zeolite</text>
        <text x="65" y="94" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="7" fontFamily="system-ui">400 cpsi / 4 mil</text>
        <text x="65" y="-8" textAnchor="middle" fill="#1A5E42" fontSize="10" fontWeight="700" fontFamily="system-ui">SCR</text>
        <text x="65" y="-20" textAnchor="middle" fill="#6B7D8E" fontSize="7" fontFamily="system-ui">Selective Catalytic Reduction</text>
      </g>

      {/* Pipe SCR → ASC */}
      <rect x="663" y="155" width="25" height="30" rx="2" fill="url(#pipeGrad)" />

      {/* ===== ASC ===== */}
      <g transform="translate(693, 130)" filter="url(#shadow)">
        <rect width="60" height="80" rx="6" fill="url(#ascGrad)" />
        <rect width="60" height="80" rx="6" fill="url(#honeycomb)" />
        <ellipse cx="0" cy="40" rx="6" ry="32" fill="#352452" stroke="#4E356E" strokeWidth="1" />
        <ellipse cx="60" cy="40" rx="6" ry="32" fill="#352452" stroke="#4E356E" strokeWidth="1" />
        <text x="30" y="38" textAnchor="middle" fill="white" fontSize="12" fontWeight="800" fontFamily="system-ui">ASC</text>
        <text x="30" y="52" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="6" fontFamily="system-ui">Pt / SCR</text>
        <text x="30" y="-8" textAnchor="middle" fill="#4E356E" fontSize="9" fontWeight="700" fontFamily="system-ui">ASC</text>
        <text x="30" y="-18" textAnchor="middle" fill="#6B7D8E" fontSize="7" fontFamily="system-ui">NH₃ Slip Catalyst</text>
      </g>

      {/* Tailpipe */}
      <rect x="761" y="155" width="80" height="30" rx="2" fill="url(#pipeGrad)" />
      <text x="800" y="148" textAnchor="middle" fill="#2A9D8F" fontSize="8" fontWeight="600" fontFamily="system-ui">220°C</text>

      {/* Tailpipe exit */}
      <g transform="translate(845, 140)">
        <path d="M 0 15 L 30 5 L 30 55 L 0 45 Z" fill="url(#pipeGrad)" />
        {/* Clean exhaust wisps */}
        <path d="M 35 20 Q 50 15 55 20 Q 60 25 70 18" fill="none" stroke="#2A9D8F" strokeWidth="1.5" opacity="0.4" />
        <path d="M 35 30 Q 55 25 60 30 Q 65 35 80 28" fill="none" stroke="#2A9D8F" strokeWidth="1" opacity="0.3" />
        <path d="M 35 40 Q 50 38 58 42 Q 65 45 75 38" fill="none" stroke="#2A9D8F" strokeWidth="1" opacity="0.2" />
      </g>

      {/* ===== REACTION ANNOTATIONS ===== */}
      {/* DOC reactions */}
      <g transform="translate(245, 260)">
        <rect x="-40" y="-10" width="80" height="36" rx="4" fill="white" stroke="#2D6A8A" strokeWidth="0.8" />
        <text x="0" y="2" textAnchor="middle" fill="#1A4F6E" fontSize="7" fontWeight="600" fontFamily="system-ui">CO → CO₂</text>
        <text x="0" y="12" textAnchor="middle" fill="#1A4F6E" fontSize="7" fontWeight="600" fontFamily="system-ui">HC → CO₂ + H₂O</text>
        <text x="0" y="22" textAnchor="middle" fill="#1A4F6E" fontSize="7" fontWeight="600" fontFamily="system-ui">NO → NO₂</text>
      </g>

      {/* DPF function */}
      <g transform="translate(398, 268)">
        <rect x="-35" y="-10" width="70" height="26" rx="4" fill="white" stroke="#5C4028" strokeWidth="0.8" />
        <text x="0" y="2" textAnchor="middle" fill="#5C4028" fontSize="7" fontWeight="600" fontFamily="system-ui">PM Filtration</text>
        <text x="0" y="12" textAnchor="middle" fill="#5C4028" fontSize="7" fontWeight="600" fontFamily="system-ui">&gt;99% Efficiency</text>
      </g>

      {/* SCR reactions */}
      <g transform="translate(590, 275)">
        <rect x="-55" y="-10" width="110" height="26" rx="4" fill="white" stroke="#1A5E42" strokeWidth="0.8" />
        <text x="0" y="2" textAnchor="middle" fill="#0F4030" fontSize="7" fontWeight="600" fontFamily="system-ui">4NO + 4NH₃ + O₂ → 4N₂ + 6H₂O</text>
        <text x="0" y="12" textAnchor="middle" fill="#0F4030" fontSize="7" fontWeight="600" fontFamily="system-ui">DeNOₓ &gt;97%</text>
      </g>

      {/* Flow direction arrow */}
      <g transform="translate(550, 320)">
        <line x1="-300" y1="0" x2="300" y2="0" stroke="#1A4F6E" strokeWidth="1" markerEnd="url(#arrowhead)" opacity="0.3" />
        <text x="0" y="14" textAnchor="middle" fill="#6B7D8E" fontSize="8" fontFamily="system-ui" fontWeight="600">EXHAUST GAS FLOW →</text>
      </g>
    </svg>
  );
}

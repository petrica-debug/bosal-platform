"use client";

/**
 * Professional SVG diagram of a SOFC fuel processing system.
 * Shows: Fuel → Desulfurizer → Pre-Reformer → Main Reformer → WGS → SOFC Stack
 * Presentation-grade — Siemens/Bosch engineering aesthetic.
 */
export function SOFCSystemDiagram({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1100 420"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="sofc-pipe" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8FA3B3" />
          <stop offset="50%" stopColor="#A8BCC8" />
          <stop offset="100%" stopColor="#8FA3B3" />
        </linearGradient>
        <linearGradient id="sofc-reactor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2D6A8A" />
          <stop offset="40%" stopColor="#1A4F6E" />
          <stop offset="100%" stopColor="#0F3652" />
        </linearGradient>
        <linearGradient id="sofc-reformer" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C44536" />
          <stop offset="40%" stopColor="#A33327" />
          <stop offset="100%" stopColor="#772222" />
        </linearGradient>
        <linearGradient id="sofc-wgs" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E6A23C" />
          <stop offset="40%" stopColor="#C48A2A" />
          <stop offset="100%" stopColor="#8A6020" />
        </linearGradient>
        <linearGradient id="sofc-stack" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2A9D8F" />
          <stop offset="40%" stopColor="#1A7A6E" />
          <stop offset="100%" stopColor="#0F5A50" />
        </linearGradient>
        <linearGradient id="sofc-desulf" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6A4A8A" />
          <stop offset="40%" stopColor="#4E356E" />
          <stop offset="100%" stopColor="#352452" />
        </linearGradient>
        <linearGradient id="sofc-fuel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E6A23C" />
          <stop offset="100%" stopColor="#C48A2A" />
        </linearGradient>
        <linearGradient id="sofc-steam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4ECDC4" />
          <stop offset="100%" stopColor="#2A9D8F" />
        </linearGradient>
        <linearGradient id="sofc-heat" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#E63946" stopOpacity="0" />
          <stop offset="100%" stopColor="#E63946" stopOpacity="0.3" />
        </linearGradient>
        <filter id="sofc-shadow" x="-4%" y="-4%" width="108%" height="112%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15" />
        </filter>
      </defs>

      <rect width="1100" height="420" rx="8" fill="white" />

      {/* Title */}
      <text x="550" y="28" textAnchor="middle" fill="#1A4F6E" fontSize="15" fontWeight="700" fontFamily="system-ui, sans-serif" letterSpacing="0.05em">
        SOFC FUEL PROCESSING SYSTEM — STEAM METHANE REFORMING
      </text>
      <line x1="180" y1="36" x2="920" y2="36" stroke="#1A4F6E" strokeWidth="0.5" opacity="0.4" />

      {/* ===== FUEL SUPPLY ===== */}
      <g transform="translate(30, 140)" filter="url(#sofc-shadow)">
        <rect width="80" height="100" rx="8" fill="url(#sofc-fuel)" />
        <text x="40" y="40" textAnchor="middle" fill="white" fontSize="10" fontWeight="700" fontFamily="system-ui">CH₄</text>
        <text x="40" y="55" textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="7" fontFamily="system-ui">Natural Gas</text>
        <text x="40" y="68" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="7" fontFamily="system-ui">Pipeline NG</text>
        <text x="40" y="80" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="7" fontFamily="system-ui">93% CH₄</text>
        <text x="40" y="-8" textAnchor="middle" fill="#C48A2A" fontSize="10" fontWeight="700" fontFamily="system-ui">FUEL SUPPLY</text>
      </g>

      {/* Pipe → Desulfurizer */}
      <rect x="115" y="175" width="30" height="20" rx="2" fill="url(#sofc-pipe)" />

      {/* ===== DESULFURIZER ===== */}
      <g transform="translate(150, 135)" filter="url(#sofc-shadow)">
        <rect width="75" height="110" rx="6" fill="url(#sofc-desulf)" />
        {/* ZnO pellets */}
        {[0, 1, 2, 3, 4].map((row) =>
          [0, 1, 2, 3].map((col) => (
            <circle key={`${row}-${col}`} cx={15 + col * 14} cy={20 + row * 18} r="4" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.6" />
          ))
        )}
        <text x="37" y="55" textAnchor="middle" fill="white" fontSize="9" fontWeight="700" fontFamily="system-ui">ZnO</text>
        <text x="37" y="68" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="6" fontFamily="system-ui">H₂S → ZnS</text>
        <text x="37" y="-8" textAnchor="middle" fill="#4E356E" fontSize="9" fontWeight="700" fontFamily="system-ui">DESULF.</text>
        <text x="37" y="-18" textAnchor="middle" fill="#6B7D8E" fontSize="7" fontFamily="system-ui">H₂S Removal</text>
      </g>

      {/* Pipe → Pre-Reformer */}
      <rect x="230" y="175" width="30" height="20" rx="2" fill="url(#sofc-pipe)" />

      {/* Steam injection */}
      <g transform="translate(250, 80)">
        <rect x="-20" y="-30" width="50" height="30" rx="4" fill="url(#sofc-steam)" filter="url(#sofc-shadow)" />
        <text x="5" y="-10" textAnchor="middle" fill="white" fontSize="8" fontWeight="700" fontFamily="system-ui">STEAM</text>
        <line x1="5" y1="0" x2="5" y2="85" stroke="#4ECDC4" strokeWidth="2" strokeDasharray="4 2" />
        <polygon points="0,85 10,85 5,92" fill="#4ECDC4" />
        <text x="30" y="40" fill="#2A9D8F" fontSize="7" fontWeight="600" fontFamily="system-ui">S/C = 3.0</text>
      </g>

      {/* ===== PRE-REFORMER ===== */}
      <g transform="translate(265, 130)" filter="url(#sofc-shadow)">
        <rect width="85" height="120" rx="6" fill="url(#sofc-reactor)" />
        {/* Catalyst bed */}
        {[0, 1, 2, 3, 4, 5].map((row) =>
          [0, 1, 2, 3, 4].map((col) => (
            <circle key={`${row}-${col}`} cx={12 + col * 14} cy={15 + row * 16} r="3.5" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
          ))
        )}
        <text x="42" y="55" textAnchor="middle" fill="white" fontSize="9" fontWeight="700" fontFamily="system-ui">Ni/CaAl₂O₄</text>
        <text x="42" y="70" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="7" fontFamily="system-ui">Adiabatic</text>
        <text x="42" y="82" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="7" fontFamily="system-ui">450–550°C</text>
        <text x="42" y="-8" textAnchor="middle" fill="#1A4F6E" fontSize="9" fontWeight="700" fontFamily="system-ui">PRE-REFORMER</text>
        <text x="42" y="-18" textAnchor="middle" fill="#6B7D8E" fontSize="7" fontFamily="system-ui">C₂+ Cracking</text>
      </g>

      {/* Pipe → Main Reformer */}
      <rect x="355" y="175" width="30" height="20" rx="2" fill="url(#sofc-pipe)" />

      {/* ===== MAIN REFORMER ===== */}
      <g transform="translate(390, 110)" filter="url(#sofc-shadow)">
        <rect width="120" height="160" rx="6" fill="url(#sofc-reformer)" />
        {/* Heat indication */}
        <rect x="3" y="3" width="114" height="154" rx="4" fill="url(#sofc-heat)" />
        {/* Tube bank */}
        {[0, 1, 2, 3, 4, 5, 6].map((row) =>
          [0, 1, 2, 3, 4].map((col) => (
            <circle key={`${row}-${col}`} cx={18 + col * 20} cy={18 + row * 19} r="5" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
          ))
        )}
        <text x="60" y="75" textAnchor="middle" fill="white" fontSize="11" fontWeight="800" fontFamily="system-ui">SMR</text>
        <text x="60" y="92" textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="7" fontFamily="system-ui">Ni/Al₂O₃</text>
        <text x="60" y="105" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="7" fontFamily="system-ui">800–900°C</text>
        <text x="60" y="118" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="7" fontFamily="system-ui">+206 kJ/mol</text>
        {/* Heat arrows */}
        <text x="60" y="140" textAnchor="middle" fill="#FFD166" fontSize="7" fontWeight="600" fontFamily="system-ui">🔥 Endothermic</text>
        <text x="60" y="-8" textAnchor="middle" fill="#A33327" fontSize="10" fontWeight="700" fontFamily="system-ui">MAIN REFORMER</text>
        <text x="60" y="-20" textAnchor="middle" fill="#6B7D8E" fontSize="7" fontFamily="system-ui">CH₄ + H₂O ⇌ CO + 3H₂</text>
      </g>

      {/* Pipe → WGS */}
      <rect x="515" y="175" width="30" height="20" rx="2" fill="url(#sofc-pipe)" />

      {/* ===== WGS REACTOR ===== */}
      <g transform="translate(550, 130)" filter="url(#sofc-shadow)">
        <rect width="95" height="120" rx="6" fill="url(#sofc-wgs)" />
        {/* Two-stage indication */}
        <line x1="10" y1="60" x2="85" y2="60" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" strokeDasharray="3 2" />
        <text x="47" y="35" textAnchor="middle" fill="white" fontSize="8" fontWeight="700" fontFamily="system-ui">HT-WGS</text>
        <text x="47" y="47" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="6" fontFamily="system-ui">Fe₂O₃-Cr₂O₃</text>
        <text x="47" y="80" textAnchor="middle" fill="white" fontSize="8" fontWeight="700" fontFamily="system-ui">LT-WGS</text>
        <text x="47" y="92" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="6" fontFamily="system-ui">CuO-ZnO/Al₂O₃</text>
        <text x="47" y="-8" textAnchor="middle" fill="#8A6020" fontSize="9" fontWeight="700" fontFamily="system-ui">WGS SHIFT</text>
        <text x="47" y="-18" textAnchor="middle" fill="#6B7D8E" fontSize="7" fontFamily="system-ui">CO + H₂O ⇌ CO₂ + H₂</text>
      </g>

      {/* Pipe → SOFC */}
      <rect x="650" y="175" width="40" height="20" rx="2" fill="url(#sofc-pipe)" />

      {/* Reformate composition label */}
      <g transform="translate(670, 210)">
        <rect x="-30" y="0" width="60" height="42" rx="3" fill="white" stroke="#1A4F6E" strokeWidth="0.6" />
        <text x="0" y="12" textAnchor="middle" fill="#1A4F6E" fontSize="7" fontWeight="600" fontFamily="system-ui">Reformate</text>
        <text x="0" y="22" textAnchor="middle" fill="#1A4F6E" fontSize="6" fontFamily="system-ui">H₂: ~75 mol%</text>
        <text x="0" y="31" textAnchor="middle" fill="#1A4F6E" fontSize="6" fontFamily="system-ui">CO: ~12 mol%</text>
        <text x="0" y="40" textAnchor="middle" fill="#1A4F6E" fontSize="6" fontFamily="system-ui">CO₂: ~10 mol%</text>
      </g>

      {/* ===== SOFC STACK ===== */}
      <g transform="translate(695, 100)" filter="url(#sofc-shadow)">
        <rect width="140" height="180" rx="8" fill="url(#sofc-stack)" />
        {/* Cell layers */}
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <g key={i}>
            <rect x="12" y={14 + i * 18} width="116" height="12" rx="1" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.6" />
            <rect x="14" y={16 + i * 18} width="50" height="8" rx="1" fill="rgba(255,255,255,0.08)" />
            <rect x="76" y={16 + i * 18} width="50" height="8" rx="1" fill="rgba(255,255,255,0.05)" />
          </g>
        ))}
        <text x="70" y="85" textAnchor="middle" fill="white" fontSize="14" fontWeight="800" fontFamily="system-ui">SOFC</text>
        <text x="70" y="102" textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="7" fontFamily="system-ui">Ni-YSZ / YSZ / LSM</text>
        <text x="70" y="115" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="7" fontFamily="system-ui">750–850°C</text>
        <text x="70" y="128" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="7" fontFamily="system-ui">Uf = 0.80</text>
        <text x="70" y="-8" textAnchor="middle" fill="#1A7A6E" fontSize="11" fontWeight="700" fontFamily="system-ui">SOFC STACK</text>
        <text x="70" y="-20" textAnchor="middle" fill="#6B7D8E" fontSize="7" fontFamily="system-ui">Solid Oxide Fuel Cell</text>
      </g>

      {/* Electrical output */}
      <g transform="translate(850, 130)">
        <rect x="0" y="0" width="100" height="70" rx="6" fill="white" stroke="#2A9D8F" strokeWidth="1.5" filter="url(#sofc-shadow)" />
        <text x="50" y="22" textAnchor="middle" fill="#0F5A50" fontSize="10" fontWeight="800" fontFamily="system-ui">⚡ DC Power</text>
        <text x="50" y="38" textAnchor="middle" fill="#1A7A6E" fontSize="9" fontWeight="600" fontFamily="system-ui">50 kW</text>
        <text x="50" y="52" textAnchor="middle" fill="#6B7D8E" fontSize="7" fontFamily="system-ui">η = 55–60%</text>
        <text x="50" y="62" textAnchor="middle" fill="#6B7D8E" fontSize="7" fontFamily="system-ui">(LHV basis)</text>
      </g>
      <line x1="835" y1="165" x2="850" y2="165" stroke="#2A9D8F" strokeWidth="2" />

      {/* Waste heat recovery loop */}
      <g transform="translate(765, 300)">
        <path d="M 0 0 Q 0 40 -40 40 L -400 40 Q -440 40 -440 0 L -440 -80" fill="none" stroke="#E63946" strokeWidth="1.5" strokeDasharray="6 3" opacity="0.5" />
        <text x="-220" y="55" textAnchor="middle" fill="#E63946" fontSize="8" fontWeight="600" fontFamily="system-ui" opacity="0.7">WASTE HEAT RECOVERY → REFORMER HEAT SUPPLY</text>
      </g>

      {/* Air supply to SOFC cathode */}
      <g transform="translate(765, 70)">
        <rect x="-25" y="-20" width="50" height="22" rx="4" fill="#8FA3B3" filter="url(#sofc-shadow)" />
        <text x="0" y="-5" textAnchor="middle" fill="white" fontSize="7" fontWeight="700" fontFamily="system-ui">AIR (O₂)</text>
        <line x1="0" y1="2" x2="0" y2="28" stroke="#8FA3B3" strokeWidth="1.5" strokeDasharray="3 2" />
        <polygon points="-4,28 4,28 0,34" fill="#8FA3B3" />
      </g>

      {/* Key metrics bar */}
      <g transform="translate(50, 390)">
        <rect width="1000" height="25" rx="4" fill="#F0F4F8" stroke="#1A4F6E" strokeWidth="0.5" />
        {[
          ["CH₄ Conversion: 97%", 80],
          ["H₂ Yield: 3.6 mol/mol CH₄", 280],
          ["S/C Ratio: 3.0", 460],
          ["Carbon Risk: LOW", 600],
          ["System η: 58%", 740],
          ["SOFC Output: 50 kW", 900],
        ].map(([text, x]) => (
          <text key={text as string} x={x as number} y="16" textAnchor="middle" fill="#1A4F6E" fontSize="8" fontWeight="600" fontFamily="system-ui">{text as string}</text>
        ))}
      </g>
    </svg>
  );
}

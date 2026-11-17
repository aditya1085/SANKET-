import React from 'react';
import {
  Activity,
  ArrowRight,
  BellRing,
  Cpu,
  Database,
  LayoutDashboard,
  Radio,
  Router,
  Sparkles,
} from 'lucide-react';

export const IntegrationPage: React.FC = () => {
  const architectureStages = [
    {
      step: '01',
      title: 'Sensors',
      subtitle: 'MPU6050 (vibration), DS18B20 (temp), MEMS mic (acoustic), ACS712 (current)',
      tag: 'PLANNED HARDWARE',
      mode: 'future' as const,
      icon: Radio,
    },
    {
      step: '02',
      title: 'ESP32',
      subtitle: 'Edge microcontroller sampling, packet framing & Wi-Fi/MQTT transmission',
      tag: 'PLANNED HARDWARE',
      mode: 'future' as const,
      icon: Router,
    },
    {
      step: '03',
      title: 'Data Processing',
      subtitle: 'Moving-average smoothing, signal integrity checks & baseline comparison',
      tag: 'ACTIVE (SIMULATED)',
      mode: 'current' as const,
      icon: Activity,
    },
    {
      step: '04',
      title: 'Anomaly Detection',
      subtitle: 'Transparent rule-based persistence & threshold engine (modular for future ML)',
      tag: 'RULES ACTIVE · ML PLANNED',
      mode: 'hybrid' as const,
      icon: Cpu,
    },
    {
      step: '05',
      title: 'Dashboard',
      subtitle: 'Synchronized fleet overview, Health Fingerprint & live telemetry charts',
      tag: 'ACTIVE IN PROTOTYPE',
      mode: 'current' as const,
      icon: LayoutDashboard,
    },
    {
      step: '06',
      title: 'Alerts',
      subtitle: 'Grouped events with severity, observed vs baseline & maintenance actions',
      tag: 'ACTIVE IN PROTOTYPE',
      mode: 'current' as const,
      icon: BellRing,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#F5F4F2] rounded-2xl p-5 sm:p-6 space-y-2">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="font-semibold text-[#D96B27]">
            CURRENT: Software Simulation (No Hardware Connected)
          </span>
          <span className="text-zinc-300" aria-hidden="true">·</span>
          <span className="font-medium text-zinc-600">
            Sensors → ESP32 → Data Processing → Anomaly Detection → Dashboard → Alerts
          </span>
        </div>
        <h1 className="font-display text-3xl sm:text-[34px] font-bold tracking-tight text-zinc-900">
          Integration & Architecture
        </h1>
        <p className="text-sm sm:text-[15px] font-medium text-zinc-600 max-w-3xl leading-relaxed">
          SANKET+ currently runs as an interactive software prototype powered by in-browser simulated sensor streams and transparent rule-based anomaly detection. Physical sensors, ESP32 gateways, and trained AI/ML models are planned for subsequent hardware pilot stages.
        </p>
      </div>

      {/* Intended 6-Stage Architecture Diagram */}
      <section
        aria-labelledby="arch-diagram-heading"
        className="bg-[#F5F4F2] rounded-2xl p-5 sm:p-6 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2
              id="arch-diagram-heading"
              className="font-display text-lg font-bold text-zinc-900"
            >
              Intended End-to-End Architecture
            </h2>
            <p className="text-xs font-medium text-zinc-500 mt-0.5">
              Sensors → ESP32 → Data Processing → Anomaly Detection → Dashboard → Alerts
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[11px]">
            <span className="text-[#D96B27] font-semibold">● Current Software Simulation</span>
            <span className="text-blue-700 font-semibold">● Future AI/ML Upgrade Slot</span>
            <span className="text-zinc-500 font-medium">○ Planned Physical Hardware</span>
          </div>
        </div>

        {/* SVG Pipeline Illustration */}
        <div className="bg-white rounded-xl p-4 w-full overflow-x-auto">
          <svg
            viewBox="0 0 1120 220"
            className="w-full min-w-[820px] h-auto block"
            role="img"
            aria-label="SANKET+ Architecture: Sensors to ESP32 to Data Processing to Anomaly Detection to Dashboard to Alerts"
          >
            {/* CURRENT: Software Simulation Input Box feeding Data Processing */}
            <rect
              x="388"
              y="14"
              width="250"
              height="46"
              rx="10"
              fill="#FFF7ED"
              stroke="#D96B27"
              strokeWidth="1.5"
            />
            <text
              x="513"
              y="33"
              textAnchor="middle"
              className="fill-[#9A3412] font-sans text-[11px] font-semibold"
            >
              CURRENT: Simulated Sensor Engine
            </text>
            <text
              x="513"
              y="49"
              textAnchor="middle"
              className="fill-[#C05A1B] font-sans text-[10px]"
            >
              Replaces hardware during software demo
            </text>
            <path
              d="M465 60 V96"
              stroke="#D96B27"
              strokeWidth="1.75"
              strokeDasharray="4 3"
            />
            <polygon points="461,92 469,92 465,100" fill="#D96B27" />

            {[
              { x: 16, label: '1. Sensors', sub: 'MPU6050 · DS18B20', status: 'PLANNED HARDWARE', mode: 'future' },
              { x: 198, label: '2. ESP32', sub: 'Edge Gateway', status: 'PLANNED HARDWARE', mode: 'future' },
              { x: 380, label: '3. Data Processing', sub: 'Moving Avg & Integrity', status: 'ACTIVE (SIMULATED)', mode: 'current' },
              { x: 562, label: '4. Anomaly Detection', sub: 'Rules now · ML planned', status: 'RULES ACTIVE · ML NEXT', mode: 'hybrid' },
              { x: 744, label: '5. Dashboard', sub: 'Live & Fingerprint UI', status: 'ACTIVE IN PROTOTYPE', mode: 'current' },
              { x: 926, label: '6. Alerts', sub: 'Actions & History Log', status: 'ACTIVE IN PROTOTYPE', mode: 'current' },
            ].map((node, idx) => (
              <g key={node.label}>
                <rect
                  x={node.x}
                  y="104"
                  width="168"
                  height="88"
                  rx="10"
                  fill={node.mode === 'future' ? '#F5F4F2' : '#FFFFFF'}
                  stroke={
                    node.mode === 'future'
                      ? '#D4D4D8'
                      : node.mode === 'hybrid'
                      ? '#2563EB'
                      : '#D96B27'
                  }
                  strokeWidth={node.mode === 'future' ? '1.25' : '1.75'}
                  strokeDasharray={node.mode === 'future' ? '5 3' : undefined}
                />
                <text
                  x={node.x + 84}
                  y="132"
                  textAnchor="middle"
                  className="fill-zinc-900 font-sans text-[12px] font-semibold"
                >
                  {node.label}
                </text>
                <text
                  x={node.x + 84}
                  y="150"
                  textAnchor="middle"
                  className="fill-zinc-500 font-sans text-[10.5px]"
                >
                  {node.sub}
                </text>
                <text
                  x={node.x + 84}
                  y="174"
                  textAnchor="middle"
                  className={`font-sans text-[9.5px] font-semibold ${
                    node.mode === 'future'
                      ? 'fill-zinc-500'
                      : node.mode === 'hybrid'
                      ? 'fill-blue-700'
                      : 'fill-[#C05A1B]'
                  }`}
                >
                  {node.status}
                </text>

                {idx < 5 && (
                  <g>
                    <line
                      x1={node.x + 170}
                      y1="148"
                      x2={node.x + 180}
                      y2="148"
                      stroke="#A1A1AA"
                      strokeWidth="1.5"
                    />
                    <polygon
                      points={`${node.x + 177},144 ${node.x + 177},152 ${
                        node.x + 183
                      },148`}
                      fill="#A1A1AA"
                    />
                  </g>
                )}
              </g>
            ))}
          </svg>
        </div>

        {/* Stage Breakdown Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {architectureStages.map((stage) => {
            const Icon = stage.icon;
            return (
              <div key={stage.step} className="bg-white rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      stage.mode === 'current'
                        ? 'bg-orange-50 text-[#D96B27]'
                        : stage.mode === 'hybrid'
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-[#F5F4F2] text-zinc-600'
                    }`}
                  >
                    <Icon className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <span className="font-mono text-[11px] font-semibold text-zinc-400">
                    Stage {stage.step}
                  </span>
                </div>
                <div
                  className={`text-[10px] font-semibold ${
                    stage.mode === 'current'
                      ? 'text-[#D96B27]'
                      : stage.mode === 'hybrid'
                      ? 'text-blue-700'
                      : 'text-zinc-500'
                  }`}
                >
                  {stage.tag}
                </div>
                <div className="text-xs font-semibold text-zinc-900">
                  {stage.title}
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  {stage.subtitle}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Honest 3-Way Distinction Table */}
      <section className="bg-[#F5F4F2] rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-zinc-700" aria-hidden="true" />
          <h2 className="font-display text-lg font-bold text-zinc-900">
            Prototype Boundaries: Simulation vs. Hardware vs. Future AI/ML
          </h2>
        </div>

        <div className="bg-white rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/70 text-[11px] font-semibold text-zinc-500">
                <th className="py-2.5 px-4">Layer</th>
                <th className="py-2.5 px-4">Implementation Details</th>
                <th className="py-2.5 px-4">Status in This Prototype</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              <tr>
                <td className="py-3 px-4 font-semibold text-zinc-900">
                  1. Current Software Simulation
                </td>
                <td className="py-3 px-4 text-zinc-600">
                  In-browser simulation engine generates vibration (mm/s), temperature (°C), acoustic (dB), and current (A) streams across 6 test scenarios, with moving-average filtering and persistence rules.
                </td>
                <td className="py-3 px-4 text-[#D96B27] font-semibold whitespace-nowrap">
                  CURRENT: Active (Simulated Data)
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-zinc-900">
                  2. Planned Physical Sensor Integration
                </td>
                <td className="py-3 px-4 text-zinc-600">
                  Physical MPU6050 vibration, DS18B20 thermal probe, MEMS acoustic sensor, ACS712 current sensor, and ESP32 microcontroller transmitting MQTT/HTTPS packets.
                </td>
                <td className="py-3 px-4 text-zinc-500 font-medium whitespace-nowrap">
                  PLANNED: Not connected in demo
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-zinc-900">
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    3. Future AI/ML Development
                  </span>
                </td>
                <td className="py-3 px-4 text-zinc-600">
                  Modular AnomalyDetector interface allows replacing transparent threshold/persistence rules with a trained ML anomaly model once real labelled machine telemetry is collected. No trained ML model is claimed here.
                </td>
                <td className="py-3 px-4 text-blue-700 font-semibold whitespace-nowrap">
                  FUTURE: Rule-based engine active now
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-2 text-xs text-zinc-600 px-1">
          <ArrowRight className="w-3.5 h-3.5 text-[#D96B27] shrink-0" />
          <span>
            Every reading shown in Overview, Machines, Health Fingerprint, Live Monitoring, and Simulation Lab is clearly tagged as <strong>SIMULATED DATA</strong>.
          </span>
        </div>
      </section>
    </div>
  );
};

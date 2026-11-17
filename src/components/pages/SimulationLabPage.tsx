import React from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Flame,
  FlaskConical,
  Pause,
  Play,
  RotateCcw,
  Square,
  StepForward,
  TrendingUp,
  Waves,
  WifiOff,
} from 'lucide-react';
import { useSanket } from '../../context/SanketContext';
import { SIMULATION_SCENARIOS } from '../../data/initialData';
import { SensorFaultMode, SimulationScenarioId } from '../../types/sanket';
import { ConditionCharts } from '../charts/ConditionCharts';
import { SensorHealthLabel, StatusLabel } from '../common/StatusLabel';

const SCENARIO_ICONS: Record<
  SimulationScenarioId,
  React.FC<{ className?: string }>
> = {
  healthy: CheckCircle2,
  gradual_vibration: TrendingUp,
  overheating: Flame,
  combined_anomaly: AlertTriangle,
  temporary_fluctuation: Waves,
  sensor_disconnection: WifiOff,
};

export const SimulationLabPage: React.FC = () => {
  const {
    machines,
    healthMetricsByMachine,
    selectedMachineId,
    setSelectedMachineId,
    startScenario,
    pauseScenario,
    resumeScenario,
    stopScenario,
    restartScenario,
    resetMachineScenario,
    setMachineFaultMode,
    stepSimulatedSample,
    resetDemoData,
    setActivePage,
  } = useSanket();

  const targetMachine =
    machines.find((m) => m.id === selectedMachineId) ?? machines[0];
  const targetMetrics = healthMetricsByMachine[targetMachine.id];
  const activeScenarioDef =
    SIMULATION_SCENARIOS.find((s) => s.id === targetMachine.activeScenario) ??
    SIMULATION_SCENARIOS[0];

  const hasValidSignal =
    targetMachine.sensorHealth === 'Connected' &&
    targetMachine.latestVibrationMmS !== null &&
    targetMachine.latestTemperatureC !== null;

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-[#F5F4F2] rounded-2xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#D96B27]">
            <FlaskConical className="w-4 h-4" aria-hidden="true" />
            <span>Safe Test Sandbox · SIMULATED DATA ONLY</span>
          </div>
          <h1 className="font-display text-3xl sm:text-[34px] font-bold tracking-tight text-zinc-900">
            Simulation Lab
          </h1>
          <p className="text-sm sm:text-[15px] font-medium text-zinc-600">
            Pick a machine and run any test scenario below to see how SANKET+ detects gradual wear, overheating, temporary bumps, or disconnected sensors across every page.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2.5 shrink-0">
          <div>
            <label
              htmlFor="sim-target-machine"
              className="block text-[11px] font-medium text-zinc-500 mb-1"
            >
              Target Machine
            </label>
            <select
              id="sim-target-machine"
              value={targetMachine.id}
              onChange={(e) => setSelectedMachineId(e.target.value)}
              className="px-4 py-2 text-xs font-medium bg-white border border-zinc-200 rounded-full text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#D96B27]/40"
            >
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id} — {m.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => resetMachineScenario(targetMachine.id)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 transition-colors whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset {targetMachine.id}</span>
          </button>

          <button
            type="button"
            onClick={resetDemoData}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 transition-colors whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo</span>
          </button>
        </div>
      </div>

      {/* Currently Running Scenario Banner & Transport Controls */}
      <div className="bg-[#F5F4F2] rounded-2xl p-4 sm:px-6 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-xs">
          <span
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              targetMachine.scenarioRunning
                ? 'bg-emerald-600'
                : targetMachine.scenarioPaused
                ? 'bg-amber-500'
                : 'bg-zinc-400'
            }`}
          />
          <div>
            <span className="font-semibold text-zinc-900">
              Active Scenario on {targetMachine.id}:{' '}
              <span className="text-[#D96B27]">
                Scenario {activeScenarioDef.code} — {activeScenarioDef.title}
              </span>
            </span>
            <span className="ml-2 text-zinc-500 tabular-nums">
              ({targetMachine.scenarioRunning
                ? `Running · Step ${targetMachine.scenarioStep}`
                : targetMachine.scenarioPaused
                ? `Paused at Step ${targetMachine.scenarioStep}`
                : `Stopped · Step ${targetMachine.scenarioStep}`})
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {targetMachine.scenarioRunning ? (
            <button
              type="button"
              onClick={() => pauseScenario(targetMachine.id)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-amber-500 text-white hover:bg-amber-600 transition-colors"
            >
              <Pause className="w-3 h-3" />
              <span>Pause</span>
            </button>
          ) : targetMachine.scenarioPaused ? (
            <button
              type="button"
              onClick={() => resumeScenario(targetMachine.id)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-700 text-white hover:bg-emerald-800 transition-colors"
            >
              <Play className="w-3 h-3" />
              <span>Resume</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                startScenario(
                  targetMachine.id,
                  targetMachine.activeScenario,
                  targetMachine.sensorFaultMode
                )
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#D96B27] text-white hover:bg-[#C05A1B] transition-colors"
            >
              <Play className="w-3 h-3" />
              <span>Start</span>
            </button>
          )}

          {(targetMachine.scenarioRunning || targetMachine.scenarioPaused) && (
            <button
              type="button"
              onClick={() => stopScenario(targetMachine.id)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-zinc-900 text-white hover:bg-zinc-800 transition-colors"
            >
              <Square className="w-3 h-3" />
              <span>Stop</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => restartScenario(targetMachine.id)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white border border-zinc-200 text-zinc-800 hover:bg-zinc-50 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Restart</span>
          </button>
        </div>
      </div>

      {/* Six Scenario Cards */}
      <section aria-label="Simulated Test Scenarios" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {SIMULATION_SCENARIOS.map((scenario) => {
          const Icon = SCENARIO_ICONS[scenario.id];
          const isSelectedScenario = targetMachine.activeScenario === scenario.id;
          const isRunning = isSelectedScenario && targetMachine.scenarioRunning;
          const isPaused = isSelectedScenario && targetMachine.scenarioPaused;

          return (
            <article
              key={scenario.id}
              className={`rounded-2xl p-5 flex flex-col justify-between transition-colors ${
                isRunning
                  ? 'bg-[#F5F4F2] ring-2 ring-[#D96B27]'
                  : isPaused
                  ? 'bg-[#F5F4F2] ring-2 ring-amber-400'
                  : isSelectedScenario
                  ? 'bg-[#F5F4F2] ring-1 ring-zinc-400'
                  : 'bg-[#F5F4F2] hover:ring-1 hover:ring-zinc-300'
              }`}
            >
              <div className="bg-white rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#F5F4F2] flex items-center justify-center">
                    <Icon className="w-4 h-4 text-[#D96B27]" aria-hidden="true" />
                  </div>
                  <span className="text-[11px] font-medium text-zinc-500">
                    Scenario {scenario.code} · {scenario.effectLabel}
                  </span>
                </div>

                <div>
                  <h2 className="font-display text-[17px] font-bold text-zinc-900">
                    {scenario.title}
                  </h2>
                  <p className="mt-1.5 text-[13px] text-zinc-600 leading-relaxed">
                    {scenario.description}
                  </p>
                </div>

                {scenario.id === 'sensor_disconnection' && (
                  <div className="pt-2 border-t border-zinc-100">
                    <div className="text-[11px] font-medium text-zinc-500 mb-1.5">
                      Sensor Fault Mode
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { id: 'missing', label: 'Missing' },
                          { id: 'frozen', label: 'Frozen' },
                          { id: 'invalid', label: 'Invalid' },
                        ] as Array<{ id: SensorFaultMode; label: string }>
                      ).map((mode) => (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() =>
                            setMachineFaultMode(targetMachine.id, mode.id)
                          }
                          className={`px-2 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                            targetMachine.sensorFaultMode === mode.id
                              ? 'border-zinc-900 bg-zinc-900 text-white'
                              : 'border-zinc-200 bg-white text-zinc-600 hover:bg-[#F5F4F2]'
                          }`}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-zinc-100 text-[11px] text-zinc-500 leading-relaxed">
                  <strong className="text-zinc-700 font-medium">Expected result: </strong>
                  {scenario.expectedOutcome}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-2 px-1">
                <span className="text-[11px] text-zinc-500 tabular-nums">
                  {isRunning
                    ? `Running (step ${targetMachine.scenarioStep})`
                    : isPaused
                    ? `Paused (step ${targetMachine.scenarioStep})`
                    : isSelectedScenario
                    ? `Selected (${targetMachine.id})`
                    : `Target: ${targetMachine.id}`}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {isRunning ? (
                    <>
                      <button
                        type="button"
                        onClick={() => pauseScenario(targetMachine.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors whitespace-nowrap"
                      >
                        <Pause className="w-3 h-3" />
                        <span>Pause</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => stopScenario(targetMachine.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 transition-colors whitespace-nowrap"
                      >
                        <Square className="w-3 h-3" />
                        <span>Stop</span>
                      </button>
                    </>
                  ) : isPaused ? (
                    <>
                      <button
                        type="button"
                        onClick={() => resumeScenario(targetMachine.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-700 text-white hover:bg-emerald-800 transition-colors whitespace-nowrap"
                      >
                        <Play className="w-3 h-3" />
                        <span>Resume</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          startScenario(
                            targetMachine.id,
                            scenario.id,
                            targetMachine.sensorFaultMode
                          )
                        }
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-white border border-zinc-200 text-zinc-800 hover:bg-zinc-50 transition-colors whitespace-nowrap"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Restart</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        startScenario(
                          targetMachine.id,
                          scenario.id,
                          targetMachine.sensorFaultMode
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium bg-[#D96B27] text-white hover:bg-[#C05A1B] transition-colors whitespace-nowrap"
                    >
                      <Play className="w-3 h-3" />
                      <span>Start Scenario</span>
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </section>

      {/* Live Response Preview for Target Machine */}
      <section className="bg-[#F5F4F2] rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Activity className="w-4 h-4 text-[#D96B27] mt-1 shrink-0" aria-hidden="true" />
            <div>
              <h2 className="font-display text-lg font-bold text-zinc-900">
                {targetMachine.name} ({targetMachine.id}) — Live Response Preview
              </h2>
              <p className="text-[13px] font-medium text-zinc-600 mt-0.5">
                {targetMachine.statusSummary}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <StatusLabel
              status={targetMachine.healthStatus}
              sensorHealth={targetMachine.sensorHealth}
            />
            <SensorHealthLabel sensorHealth={targetMachine.sensorHealth} />
            <button
              type="button"
              onClick={() => stepSimulatedSample(targetMachine.id)}
              className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white border border-zinc-200 text-zinc-800 hover:bg-zinc-50"
            >
              <StepForward className="w-3.5 h-3.5" />
              <span>Step Reading</span>
            </button>
            <button
              type="button"
              onClick={() => setActivePage('alerts')}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white text-[#D96B27] hover:underline"
            >
              View Alerts
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 pb-3 border-b border-zinc-100 text-xs">
            <div>
              <span className="text-zinc-500 font-medium">Vibration (Simulated)</span>
              <div className="text-lg font-bold text-zinc-900 tabular-nums mt-0.5">
                {hasValidSignal && targetMachine.latestVibrationMmS !== null
                  ? `${targetMachine.latestVibrationMmS.toFixed(2)} mm/s`
                  : 'No Valid Signal'}
              </div>
            </div>
            <div>
              <span className="text-zinc-500 font-medium">Temperature (Simulated)</span>
              <div className="text-lg font-bold text-zinc-900 tabular-nums mt-0.5">
                {hasValidSignal && targetMachine.latestTemperatureC !== null
                  ? `${targetMachine.latestTemperatureC.toFixed(1)} °C`
                  : 'No Valid Signal'}
              </div>
            </div>
            <div>
              <span className="text-zinc-500 font-medium">Health Score</span>
              <div className="text-lg font-bold text-zinc-900 tabular-nums mt-0.5">
                {targetMetrics?.healthScore !== null &&
                targetMetrics?.healthScore !== undefined
                  ? `${targetMetrics.healthScore} / 100`
                  : 'Unverified'}
              </div>
            </div>
            <div>
              <span className="text-zinc-500 font-medium">Active Scenario</span>
              <div className="text-sm font-bold text-zinc-800 mt-0.5">
                {activeScenarioDef.title}
              </div>
            </div>
            <div>
              <span className="text-zinc-500 font-medium">Scenario Engine</span>
              <div className="text-sm font-bold text-zinc-800 mt-0.5">
                {targetMachine.scenarioRunning
                  ? 'Running Live'
                  : targetMachine.scenarioPaused
                  ? 'Paused'
                  : 'Stopped'}
              </div>
            </div>
          </div>

          <ConditionCharts machine={targetMachine} height={140} />
        </div>
      </section>
    </div>
  );
};

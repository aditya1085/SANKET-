import React from 'react';
import {
  BellRing,
  Pause,
  Play,
  RotateCcw,
  StepForward,
} from 'lucide-react';
import { useSanket } from '../../context/SanketContext';
import {
  formatDateTime,
  formatTimestamp,
  getAlertStatusTone,
  getSeverityTone,
} from '../../utils/formatters';
import { ConditionCharts } from '../charts/ConditionCharts';
import { InfoTooltip } from '../common/InfoTooltip';
import { SensorHealthLabel, StatusLabel } from '../common/StatusLabel';
import {
  MachineHealthGaugeVisual,
  VibrationWaveformVisual,
} from '../illustrations/MachineIllustrations';

export const LiveMonitoringPage: React.FC = () => {
  const {
    machines,
    alerts,
    healthMetricsByMachine,
    selectedMachineId,
    setSelectedMachineId,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    sampleIntervalMs,
    setSampleIntervalMs,
    stepSimulatedSample,
    resetMachineScenario,
    setActivePage,
    settings,
  } = useSanket();

  const machine =
    machines.find((m) => m.id === selectedMachineId) ?? machines[0];
  const metrics = healthMetricsByMachine[machine.id];

  const hasValidSignal =
    machine.sensorHealth === 'Connected' &&
    machine.latestVibrationMmS !== null &&
    machine.latestTemperatureC !== null;

  const vibDiffPct = metrics?.vibrationDeviationPct ?? null;
  const tempDiffC = metrics?.temperatureDeltaC ?? null;
  const deviationScore = metrics?.deviationPercent ?? 0;

  const vibRatio =
    hasValidSignal && machine.latestVibrationMmS !== null
      ? machine.latestVibrationMmS /
        Math.max(0.5, machine.fingerprint.vibrationMeanMmS)
      : 0.35;

  const recentRows = [...machine.readings].reverse().slice(0, 8);
  const machineEvents = alerts
    .filter((a) => a.machineId === machine.id)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header & Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-[34px] font-bold tracking-tight text-zinc-900">
            Live Monitoring
          </h1>
          <p className="mt-1.5 text-sm sm:text-[15px] font-medium text-zinc-600">
            Watch live simulated readings for each machine and see how SANKET+ filters noise and spots sustained changes.
          </p>
        </div>

        {/* Monitoring Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="Select machine for live monitoring"
            value={machine.id}
            onChange={(e) => setSelectedMachineId(e.target.value)}
            className="px-4 py-2 text-[13px] font-semibold bg-[#F5F4F2] rounded-full text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#D96B27]/40"
          >
            {machines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id} — {m.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Simulated sampling cadence"
            value={sampleIntervalMs}
            onChange={(e) => setSampleIntervalMs(Number(e.target.value))}
            className="px-3.5 py-2 text-[13px] font-semibold bg-[#F5F4F2] rounded-full text-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#D96B27]/40"
          >
            <option value={1000}>1.0s interval</option>
            <option value={1500}>1.5s interval</option>
            <option value={2000}>2.0s interval</option>
            <option value={4000}>4.0s interval</option>
          </select>

          <button
            type="button"
            onClick={isMonitoring ? stopMonitoring : startMonitoring}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold transition-colors whitespace-nowrap ${
              isMonitoring
                ? 'bg-zinc-900 text-white hover:bg-zinc-800'
                : 'bg-[#D96B27] text-white hover:bg-[#C05A1B]'
            }`}
          >
            {isMonitoring ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Stop Monitoring</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Start Monitoring</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => stepSimulatedSample(machine.id)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-semibold bg-white border border-zinc-200 text-zinc-800 hover:bg-[#F5F4F2] transition-colors whitespace-nowrap"
          >
            <StepForward className="w-3.5 h-3.5" />
            <span>Step Sample</span>
          </button>

          {(machine.healthStatus !== 'NORMAL' ||
            machine.sensorHealth === 'SENSOR ISSUE') && (
            <button
              type="button"
              onClick={() => resetMachineScenario(machine.id)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-semibold bg-white border border-zinc-200 text-zinc-800 hover:bg-[#F5F4F2] transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restore Nominal</span>
            </button>
          )}
        </div>
      </div>

      {/* Sensor Issue Warning Banner */}
      {machine.sensorHealth === 'SENSOR ISSUE' && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 text-xs text-blue-900">
          <strong>SENSOR DISCONNECTED / COMMUNICATION WARNING ({machine.id}): </strong>
          {machine.sensorIssueDetail} Missing or invalid values are never treated as zero or healthy, and are distinguished from mechanical machine failure.
        </div>
      )}

      {/* Unverified Baseline Advisory */}
      {machine.fingerprint.status !== 'Ready for Monitoring' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-xs text-amber-900">
          <strong>Unverified Baseline ({machine.fingerprint.status}): </strong>
          Current checks are provisional only. Complete the operator baseline workflow in Health Fingerprint before treating limits as verified.
        </div>
      )}

      {/* Live Sensor Reading Cards */}
      <section
        aria-label="Simulated Live Sensor Readings"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
      >
        <div className="bg-[#F5F4F2] rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-600">
            <span>Vibration (MPU6050)</span>
            <span className="text-[11px] bg-white px-2.5 py-0.5 rounded-full text-zinc-700">SIMULATED</span>
          </div>
          <div className="mt-2 font-display text-[26px] font-bold text-zinc-900 tabular-nums">
            {hasValidSignal && machine.latestVibrationMmS !== null
              ? `${machine.latestVibrationMmS.toFixed(2)} mm/s`
              : 'No Valid Signal'}
          </div>
          <div className="mt-1.5 text-xs font-medium text-zinc-600 tabular-nums">
            {vibDiffPct !== null && metrics?.filteredVibrationMmS !== null
              ? `${vibDiffPct >= 0 ? '+' : ''}${vibDiffPct}% vs mean · 3-pt avg ${metrics?.filteredVibrationMmS?.toFixed(2)} mm/s`
              : 'Sensor communication warning'}
          </div>
        </div>

        <div className="bg-[#F5F4F2] rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-600">
            <span>Temperature (DS18B20)</span>
            <span className="text-[11px] bg-white px-2.5 py-0.5 rounded-full text-zinc-700">SIMULATED</span>
          </div>
          <div className="mt-2 font-display text-[26px] font-bold text-zinc-900 tabular-nums">
            {hasValidSignal && machine.latestTemperatureC !== null
              ? `${machine.latestTemperatureC.toFixed(1)} °C`
              : 'No Valid Signal'}
          </div>
          <div className="mt-1.5 text-xs font-medium text-zinc-600 tabular-nums">
            {tempDiffC !== null && metrics?.filteredTemperatureC !== null
              ? `${tempDiffC >= 0 ? '+' : ''}${tempDiffC.toFixed(1)} °C vs mean · 3-pt avg ${metrics?.filteredTemperatureC?.toFixed(1)} °C`
              : 'Sensor communication warning'}
          </div>
        </div>

        <div className="bg-[#F5F4F2] rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-600">
            <span>Acoustic & Current</span>
            <span className="text-[11px] bg-white px-2.5 py-0.5 rounded-full text-zinc-700">SIMULATED</span>
          </div>
          <div className="mt-2 font-display text-[22px] font-bold text-zinc-900 tabular-nums">
            {hasValidSignal &&
            machine.latestAcousticDb !== null &&
            machine.latestCurrentAmps !== null
              ? `${machine.latestAcousticDb.toFixed(1)} dB · ${machine.latestCurrentAmps.toFixed(1)} A`
              : 'No Valid Signal'}
          </div>
          <div className="mt-1.5 text-xs font-medium text-zinc-600 tabular-nums">
            MEMS Mic & ACS712 · Sensitivity: {settings.sensitivity}
          </div>
        </div>

        <div className="bg-[#F5F4F2] rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-600">
            <span>Condition & Score</span>
            <span className="text-xs font-medium tabular-nums">
              {formatTimestamp(machine.lastUpdated)}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <StatusLabel
              status={machine.healthStatus}
              sensorHealth={machine.sensorHealth}
            />
            <span className="font-mono text-xs font-bold text-zinc-900 tabular-nums">
              {metrics?.healthScore !== null && metrics?.healthScore !== undefined
                ? `Score ${metrics.healthScore}/100`
                : 'Unverified'}
            </span>
          </div>
          <div className="mt-1.5">
            <SensorHealthLabel sensorHealth={machine.sensorHealth} />
          </div>
        </div>
      </section>

      {/* Main Charts & Diagnostic Panel */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8 bg-[#F5F4F2] rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-bold text-zinc-900">
                {machine.name} ({machine.id}) — Vibration & Temperature Stream
              </h2>
              <p className="text-xs font-medium text-zinc-500 mt-0.5">
                {isMonitoring || machine.scenarioRunning
                  ? `Updating simulated readings every ${(sampleIntervalMs / 1000).toFixed(1)}s`
                  : 'Monitoring paused · Click Start Monitoring or Step Sample'}
              </p>
            </div>
            <span className="text-xs font-semibold text-[#D96B27] bg-white px-3 py-1 rounded-full self-start sm:self-auto">
              SIMULATED DATA STREAM
            </span>
          </div>

          <div className="bg-white rounded-xl p-4 sm:p-5">
            <ConditionCharts machine={machine} height={158} />
          </div>
        </div>

        <div className="xl:col-span-4 space-y-5">
          <div className="bg-[#F5F4F2] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2">
              <div className="flex items-center gap-1.5">
                <h2 className="font-display text-lg font-bold text-zinc-900">
                  Condition Assessment
                </h2>
                <InfoTooltip
                  label="Moving-Average & Persistence"
                  explanation="Uses a 3-sample moving average and persistence checks so single noisy spikes do not trigger false critical alerts."
                />
              </div>
              <StatusLabel
                status={machine.healthStatus}
                sensorHealth={machine.sensorHealth}
              />
            </div>

            <div className="bg-white rounded-xl p-4 space-y-4">
              <div className="flex justify-center py-1">
                <MachineHealthGaugeVisual
                  status={machine.healthStatus}
                  sensorHealth={machine.sensorHealth}
                  deviationPercent={deviationScore}
                />
              </div>

              <p className="text-xs text-zinc-600 leading-relaxed">
                {machine.statusSummary}
              </p>

              <div className="pt-3 border-t border-zinc-100 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Waveform Preview (Simulated)</span>
                  <span className="font-medium text-zinc-700 tabular-nums">
                    {hasValidSignal && machine.latestVibrationMmS !== null
                      ? `${machine.latestVibrationMmS.toFixed(2)} mm/s`
                      : 'No Signal'}
                  </span>
                </div>
                <VibrationWaveformVisual
                  amplitude={vibRatio}
                  accentColor={
                    machine.healthStatus === 'CRITICAL' ? '#DC2626' : '#D96B27'
                  }
                  className="w-full h-12"
                />
              </div>
            </div>
          </div>

          {/* Detection Events for this machine */}
          <div className="bg-[#F5F4F2] rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BellRing className="w-4 h-4 text-[#D96B27]" aria-hidden="true" />
                <h2 className="font-display text-base font-bold text-zinc-900">
                  Detection Events ({machine.id})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActivePage('alerts')}
                className="text-xs font-semibold text-[#D96B27] hover:underline"
              >
                All Alerts
              </button>
            </div>

            <div className="bg-white rounded-xl divide-y divide-zinc-100 px-3.5">
              {machineEvents.length === 0 ? (
                <div className="py-6 text-center text-xs text-zinc-500">
                  No detection events recorded for {machine.id}.
                </div>
              ) : (
                machineEvents.map((ev) => (
                  <div key={ev.id} className="py-2.5 space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-zinc-900 truncate">
                        {ev.alertType}
                      </span>
                      <span className={`font-semibold shrink-0 ${getSeverityTone(ev.severity)}`}>
                        {ev.severity}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-600 leading-relaxed">
                      {ev.whatChanged}
                    </p>
                    <div className="flex items-center justify-between text-[10.5px] text-zinc-400 tabular-nums">
                      <span>
                        {ev.id} · {formatDateTime(ev.timestamp)}
                      </span>
                      <span className={getAlertStatusTone(ev.status)}>{ev.status}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Reading History */}
      <section className="bg-[#F5F4F2] rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-zinc-900">
              Recent Simulated Readings · {machine.id}
            </h2>
            <p className="text-xs font-medium text-zinc-500">
              Latest 8 simulated readings with units and sensor connection status
            </p>
          </div>
          <span className="text-xs font-semibold text-zinc-700 bg-white px-3 py-1 rounded-full">
            SIMULATED SENSOR DATA
          </span>
        </div>
        <div className="bg-white rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/70 text-[11px] font-semibold text-zinc-500">
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-4">Vibration (mm/s)</th>
                <th className="py-2.5 px-4">Temperature (°C)</th>
                <th className="py-2.5 px-4">Acoustic (dB)</th>
                <th className="py-2.5 px-4">Current (A)</th>
                <th className="py-2.5 px-4">Sensor Status</th>
                <th className="py-2.5 px-4">Evaluated Condition</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {recentRows.map((row, idx) => (
                <tr key={`${row.timestamp}-${idx}`}>
                  <td className="py-2.5 px-4 text-zinc-600 tabular-nums">
                    {formatDateTime(row.timestamp)}
                  </td>
                  <td className="py-2.5 px-4 font-medium text-zinc-900 tabular-nums">
                    {row.sensorHealth === 'Connected' && row.vibrationMmS !== null
                      ? `${row.vibrationMmS.toFixed(2)} mm/s`
                      : '—'}
                  </td>
                  <td className="py-2.5 px-4 font-medium text-zinc-900 tabular-nums">
                    {row.sensorHealth === 'Connected' && row.temperatureC !== null
                      ? `${row.temperatureC.toFixed(1)} °C`
                      : '—'}
                  </td>
                  <td className="py-2.5 px-4 font-medium text-zinc-700 tabular-nums">
                    {row.sensorHealth === 'Connected' && row.acousticDb !== null
                      ? `${row.acousticDb.toFixed(1)} dB`
                      : '—'}
                  </td>
                  <td className="py-2.5 px-4 font-medium text-zinc-700 tabular-nums">
                    {row.sensorHealth === 'Connected' && row.currentAmps !== null
                      ? `${row.currentAmps.toFixed(1)} A`
                      : '—'}
                  </td>
                  <td className="py-2.5 px-4">
                    <SensorHealthLabel sensorHealth={row.sensorHealth} />
                  </td>
                  <td className="py-2.5 px-4">
                    <StatusLabel
                      status={row.machineCondition}
                      sensorHealth={row.sensorHealth}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

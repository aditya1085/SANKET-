import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Fingerprint,
  Play,
  RotateCcw,
  ShieldCheck,
  StepForward,
} from 'lucide-react';
import { useSanket } from '../../context/SanketContext';
import { BaselineStatus, ParameterConditionLevel } from '../../types/sanket';
import { formatDateTime, getBaselineTone } from '../../utils/formatters';
import { InfoTooltip } from '../common/InfoTooltip';
import { SensorHealthLabel, StatusLabel } from '../common/StatusLabel';
import {
  MachineHealthGaugeVisual,
  MachineTypeIllustration,
} from '../illustrations/MachineIllustrations';

const BASELINE_STATES: BaselineStatus[] = [
  'Not Established',
  'Learning in Progress',
  'Requires Verification',
  'Ready for Monitoring',
];

function getParamToneClass(level: ParameterConditionLevel): string {
  switch (level) {
    case 'Normal':
      return 'text-emerald-700';
    case 'Elevated':
      return 'text-amber-700';
    case 'Critical':
      return 'text-red-700';
    case 'No Signal':
      return 'text-blue-700';
  }
}

export const HealthFingerprintPage: React.FC = () => {
  const {
    machines,
    alerts,
    healthMetricsByMachine,
    selectedMachineId,
    setSelectedMachineId,
    confirmMachineHealthy,
    startBaselineLearning,
    captureLearningSample,
    completeBaseline,
    resetBaseline,
    isMonitoring,
  } = useSanket();

  const [confirmingReset, setConfirmingReset] = useState(false);

  const machine =
    machines.find((m) => m.id === selectedMachineId) ?? machines[0];
  const fp = machine.fingerprint;
  const metrics = healthMetricsByMachine[machine.id];

  const hasActiveAlert = alerts.some(
    (a) => a.machineId === machine.id && a.status === 'Active'
  );
  const canLearn =
    machine.sensorHealth === 'Connected' &&
    machine.healthStatus === 'NORMAL' &&
    !hasActiveAlert;

  const isLearning = fp.status === 'Learning in Progress';
  const samplesReady = fp.samplesCollected >= fp.samplesRequired;
  const canComplete =
    fp.healthyConfirmed &&
    samplesReady &&
    canLearn &&
    fp.status === 'Requires Verification';

  const hasValidSignal =
    machine.sensorHealth === 'Connected' &&
    machine.latestVibrationMmS !== null &&
    machine.latestTemperatureC !== null;

  return (
    <div className="space-y-6">
      {/* Intro Explanation */}
      <div className="bg-[#F5F4F2] rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-1.5 max-w-3xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#D96B27]">
            <Fingerprint className="w-4 h-4" aria-hidden="true" />
            <span>Machine-Specific Normal Range · SIMULATED DATA</span>
          </div>
          <h1 className="font-display text-3xl sm:text-[34px] font-bold tracking-tight text-zinc-900">
            Health Fingerprint
          </h1>
          <p className="text-sm sm:text-[15px] font-medium text-zinc-600 leading-relaxed">
            Every machine has its own normal operating pattern. SANKET+ compares live simulated readings against this baseline to compute an illustrative health score and classify risk.
          </p>
        </div>

        {/* Machine Selector */}
        <div className="shrink-0">
          <label
            htmlFor="fp-machine-select"
            className="block text-xs font-medium text-zinc-500 mb-1.5"
          >
            Select Machine
          </label>
          <select
            id="fp-machine-select"
            value={machine.id}
            onChange={(e) => {
              setSelectedMachineId(e.target.value);
              setConfirmingReset(false);
            }}
            className="w-full sm:w-64 px-4 py-2 text-sm font-medium bg-white border border-zinc-200 rounded-full text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#D96B27]/40"
          >
            {machines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id} — {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Synchronized Current Condition & Illustrative Health Score */}
      <section
        aria-label="Current Health Fingerprint Summary"
        className="bg-[#F5F4F2] rounded-2xl p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center"
      >
        <div className="lg:col-span-4 bg-white rounded-xl p-4 sm:p-5 flex items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-zinc-500 flex items-center gap-1">
              <span>Illustrative Health Score</span>
              <InfoTooltip
                label="Illustrative Score"
                explanation="Calculated directly from simulated vibration, temperature, acoustic, and current deviations relative to baseline. Not a validated failure probability."
              />
            </div>
            <div className="font-display text-3xl font-bold text-zinc-900 tabular-nums">
              {metrics?.healthScore !== null && metrics?.healthScore !== undefined
                ? `${metrics.healthScore} / 100`
                : 'Unverified'}
            </div>
            <div
              className={`text-xs font-bold ${
                machine.sensorHealth === 'SENSOR ISSUE'
                  ? 'text-blue-700'
                  : machine.healthStatus === 'CRITICAL'
                  ? 'text-red-700'
                  : machine.healthStatus === 'WARNING'
                  ? 'text-amber-700'
                  : 'text-emerald-700'
              }`}
            >
              {metrics?.riskClassification ?? 'Low Risk (Nominal)'}
            </div>
            <p className="text-[11px] text-zinc-500">
              Illustrative score from simulated deviations (not a validated failure probability).
            </p>
          </div>

          <div className="shrink-0">
            <MachineHealthGaugeVisual
              status={machine.healthStatus}
              sensorHealth={machine.sensorHealth}
              deviationPercent={metrics?.deviationPercent ?? 0}
            />
          </div>
        </div>

        <div className="lg:col-span-8 bg-white rounded-xl p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-zinc-900">
              Live Parameter Condition & Baseline Comparison ({machine.id})
            </span>
            <span className="text-[11px] font-medium text-zinc-500 bg-[#F5F4F2] px-2.5 py-0.5 rounded-full">
              SIMULATED DATA · 3-sample moving average
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
            <div className="p-3 rounded-xl bg-[#F5F4F2]/70 space-y-1">
              <div className="text-zinc-500 font-medium">Vibration (MPU6050)</div>
              <div className="font-bold text-zinc-900 tabular-nums">
                {hasValidSignal && machine.latestVibrationMmS !== null
                  ? `${machine.latestVibrationMmS.toFixed(2)} mm/s`
                  : 'No Signal'}
              </div>
              <div className={`font-semibold ${getParamToneClass(metrics?.vibrationStatus ?? 'No Signal')}`}>
                {metrics?.vibrationStatus ?? 'No Signal'}
                {metrics?.vibrationDeviationPct !== null && metrics?.vibrationDeviationPct !== undefined
                  ? ` (${metrics.vibrationDeviationPct >= 0 ? '+' : ''}${metrics.vibrationDeviationPct}%)`
                  : ''}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#F5F4F2]/70 space-y-1">
              <div className="text-zinc-500 font-medium">Temp (DS18B20)</div>
              <div className="font-bold text-zinc-900 tabular-nums">
                {hasValidSignal && machine.latestTemperatureC !== null
                  ? `${machine.latestTemperatureC.toFixed(1)} °C`
                  : 'No Signal'}
              </div>
              <div className={`font-semibold ${getParamToneClass(metrics?.temperatureStatus ?? 'No Signal')}`}>
                {metrics?.temperatureStatus ?? 'No Signal'}
                {metrics?.temperatureDeltaC !== null && metrics?.temperatureDeltaC !== undefined
                  ? ` (${metrics.temperatureDeltaC >= 0 ? '+' : ''}${metrics.temperatureDeltaC.toFixed(1)} °C)`
                  : ''}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#F5F4F2]/70 space-y-1">
              <div className="text-zinc-500 font-medium">Acoustic (MEMS)</div>
              <div className="font-bold text-zinc-900 tabular-nums">
                {hasValidSignal && machine.latestAcousticDb !== null
                  ? `${machine.latestAcousticDb.toFixed(1)} dB`
                  : 'No Signal'}
              </div>
              <div className={`font-semibold ${getParamToneClass(metrics?.acousticStatus ?? 'No Signal')}`}>
                {metrics?.acousticStatus ?? 'No Signal'}
                {metrics?.acousticDeltaDb !== null && metrics?.acousticDeltaDb !== undefined
                  ? ` (${metrics.acousticDeltaDb >= 0 ? '+' : ''}${metrics.acousticDeltaDb.toFixed(1)} dB)`
                  : ''}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#F5F4F2]/70 space-y-1">
              <div className="text-zinc-500 font-medium">Current (ACS712)</div>
              <div className="font-bold text-zinc-900 tabular-nums">
                {hasValidSignal && machine.latestCurrentAmps !== null
                  ? `${machine.latestCurrentAmps.toFixed(1)} A`
                  : 'No Signal'}
              </div>
              <div className={`font-semibold ${getParamToneClass(metrics?.currentStatus ?? 'No Signal')}`}>
                {metrics?.currentStatus ?? 'No Signal'}
                {metrics?.currentDeviationPct !== null && metrics?.currentDeviationPct !== undefined
                  ? ` (${metrics.currentDeviationPct >= 0 ? '+' : ''}${metrics.currentDeviationPct}%)`
                  : ''}
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-zinc-100 text-xs text-zinc-700 leading-relaxed">
            <strong className="text-zinc-900">Diagnostic Explanation: </strong>
            {metrics?.abnormalParametersExplanation ?? machine.statusSummary}
          </div>
        </div>
      </section>

      {/* Main Fingerprint Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Baseline State & Explicit 3-Step Operator Workflow */}
        <div className="lg:col-span-5 bg-[#F5F4F2] rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="bg-white rounded-xl p-4 flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-zinc-500">{machine.id}</div>
              <h2 className="font-display text-xl font-bold text-zinc-900 mt-0.5">
                {machine.name}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <StatusLabel
                  status={machine.healthStatus}
                  sensorHealth={machine.sensorHealth}
                />
                <SensorHealthLabel sensorHealth={machine.sensorHealth} />
              </div>
            </div>
            <div className="text-zinc-700 shrink-0">
              <MachineTypeIllustration type={machine.type} className="w-16 h-12" />
            </div>
          </div>

          {/* Current Baseline Status */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-zinc-600 inline-flex items-center gap-1">
                <span>Baseline Status</span>
                <InfoTooltip
                  label="Operator-Approved Baselines"
                  explanation="Baselines are never automatically approved. After learning completes, an operator must explicitly review and click Complete Baseline."
                />
              </span>
              <span className={`font-semibold ${getBaselineTone(fp.status)}`}>
                {fp.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {BASELINE_STATES.map((state) => {
                const isCurrent = fp.status === state;
                return (
                  <div
                    key={state}
                    className={`px-3 py-2 rounded-xl text-xs font-medium ${
                      isCurrent
                        ? 'bg-zinc-900 text-white'
                        : 'bg-white text-zinc-500'
                    }`}
                  >
                    {state}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Safety Block Notice if Abnormal or Sensor Issue */}
          {!canLearn && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-700 mt-0.5" />
              <span>
                Baseline confirmation and learning are blocked while {machine.id} has condition{' '}
                <strong>{machine.healthStatus}</strong>,{' '}
                <strong>{machine.sensorHealth}</strong>, or an active alert.
              </span>
            </div>
          )}

          {/* Explicit 3-Step Workflow */}
          <div className="bg-white rounded-xl p-4 space-y-4">
            <div className="text-xs font-semibold text-zinc-900">
              3-Step Baseline Setup
            </div>

            {/* Step 1: Confirm Machine Healthy */}
            <div className="flex items-center justify-between gap-3 text-xs">
              <div>
                <div className="font-medium text-zinc-800">
                  1. Confirm Machine Healthy
                </div>
                <div className="text-zinc-500 mt-0.5">
                  {fp.healthyConfirmed
                    ? `Confirmed by ${fp.confirmedBy}`
                    : 'Verify machine is running normally first'}
                </div>
              </div>
              <button
                type="button"
                disabled={!canLearn}
                onClick={() => confirmMachineHealthy(machine.id)}
                className={`px-3.5 py-1.5 rounded-full font-medium whitespace-nowrap transition-colors ${
                  fp.healthyConfirmed
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : canLearn
                    ? 'bg-zinc-900 text-white hover:bg-zinc-800'
                    : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                }`}
              >
                {fp.healthyConfirmed ? 'Confirmed' : 'Confirm Healthy'}
              </button>
            </div>

            {/* Step 2: Start Learning */}
            <div className="space-y-2 text-xs pt-3 border-t border-zinc-100">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-zinc-800">2. Start Learning</div>
                  <div className="text-zinc-500 mt-0.5 tabular-nums">
                    {fp.learningProgress}% · {fp.samplesCollected} / {fp.samplesRequired} healthy samples
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isLearning ? (
                    <button
                      type="button"
                      onClick={() => captureLearningSample(machine.id)}
                      className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full font-medium bg-[#D96B27] text-white hover:bg-[#C05A1B] whitespace-nowrap"
                    >
                      <StepForward className="w-3.5 h-3.5" />
                      <span>Capture Sample</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!fp.healthyConfirmed || !canLearn}
                      onClick={() => startBaselineLearning(machine.id)}
                      className={`inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full font-medium whitespace-nowrap ${
                        fp.healthyConfirmed && canLearn
                          ? 'bg-[#D96B27] text-white hover:bg-[#C05A1B]'
                          : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                      }`}
                    >
                      <Play className="w-3 h-3" />
                      <span>Start Learning</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#D96B27] transition-all duration-300"
                  style={{ width: `${fp.learningProgress}%` }}
                />
              </div>

              {isLearning && (
                <p className="text-[11px] text-zinc-500">
                  {isMonitoring
                    ? 'Live monitoring is active and automatically collecting healthy samples.'
                    : 'Click Capture Sample repeatedly or Start Monitoring in the header to collect all 12 samples.'}
                </p>
              )}
            </div>

            {/* Step 3: Complete Baseline */}
            <div className="flex items-center justify-between gap-3 text-xs pt-3 border-t border-zinc-100">
              <div>
                <div className="font-medium text-zinc-800">
                  3. Complete Baseline
                </div>
                <div className="text-zinc-500 mt-0.5">
                  {fp.status === 'Ready for Monitoring'
                    ? 'Approved for anomaly comparison'
                    : fp.status === 'Requires Verification' && samplesReady
                    ? 'Samples collected — operator approval required'
                    : 'Available once learning finishes'}
                </div>
              </div>
              <button
                type="button"
                disabled={!canComplete}
                onClick={() => completeBaseline(machine.id)}
                className={`inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full font-medium whitespace-nowrap ${
                  canComplete
                    ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                    : fp.status === 'Ready for Monitoring'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>
                  {fp.status === 'Ready for Monitoring'
                    ? 'Approved'
                    : 'Complete Baseline'}
                </span>
              </button>
            </div>
          </div>

          {/* Reset Baseline with Explicit Confirmation */}
          <div className="pt-1 space-y-2.5">
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>Last baseline update</span>
              <span className="tabular-nums text-zinc-700">
                {formatDateTime(fp.lastUpdated)}
              </span>
            </div>

            {!confirmingReset ? (
              <button
                type="button"
                onClick={() => setConfirmingReset(true)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 hover:text-red-700"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Stored Baseline</span>
              </button>
            ) : (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 space-y-2">
                <p className="text-xs text-red-900">
                  Reset baseline for <strong>{machine.id}</strong>? Stored reference status will return to Not Established until re-learned.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      resetBaseline(machine.id);
                      setConfirmingReset(false);
                    }}
                    className="px-3.5 py-1.5 rounded-full text-xs font-medium bg-red-700 text-white hover:bg-red-800"
                  >
                    Confirm Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingReset(false)}
                    className="px-3.5 py-1.5 rounded-full text-xs font-medium bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Baseline Readings & Operating Envelope */}
        <div className="lg:col-span-7 bg-[#F5F4F2] rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-bold text-zinc-900">
                Stored Machine Baseline Readings
              </h2>
              <p className="text-xs font-medium text-zinc-500 mt-0.5">
                {fp.isDemonstrationBaseline
                  ? 'Sample demonstration baseline values (not validated industrial limits)'
                  : 'Operator-verified baseline learned from simulated healthy samples'}
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-700 bg-white px-3 py-1 rounded-full self-start sm:self-auto">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              {fp.isDemonstrationBaseline ? 'Demo Reference' : 'Session Learned'}
            </span>
          </div>

          {/* Vibration Envelope Row */}
          <div className="bg-white rounded-xl p-4 sm:p-5 space-y-3">
            <div className="flex items-baseline justify-between flex-wrap gap-2">
              <span className="text-[15px] font-bold text-zinc-900 inline-flex items-center gap-1.5">
                <span>Normal Vibration Range (mm/s)</span>
                <InfoTooltip
                  label="Vibration RMS"
                  explanation="Root Mean Square vibration velocity in mm/s. Readings that stay above the upper ceiling trigger early warnings."
                />
              </span>
              <span className="text-xs font-medium text-zinc-600 tabular-nums">
                Current:{' '}
                <strong className="font-bold text-zinc-900">
                  {hasValidSignal && machine.latestVibrationMmS !== null
                    ? `${machine.latestVibrationMmS.toFixed(2)} mm/s`
                    : 'No Valid Signal'}
                </strong>
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-3 border-t border-zinc-100">
              <div>
                <div className="text-xs font-medium text-zinc-500">Lower Bound</div>
                <div className="text-xl font-bold text-zinc-900 tabular-nums mt-0.5">
                  {fp.vibrationMinMmS.toFixed(2)} mm/s
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-zinc-500">Typical Average</div>
                <div className="text-xl font-bold text-blue-700 tabular-nums mt-0.5">
                  {fp.vibrationMeanMmS.toFixed(2)} mm/s
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-zinc-500">Upper Ceiling</div>
                <div className="text-xl font-bold text-zinc-900 tabular-nums mt-0.5">
                  {fp.vibrationMaxMmS.toFixed(2)} mm/s
                </div>
              </div>
            </div>
          </div>

          {/* Temperature Envelope Row */}
          <div className="bg-white rounded-xl p-4 sm:p-5 space-y-3">
            <div className="flex items-baseline justify-between flex-wrap gap-2">
              <span className="text-[15px] font-bold text-zinc-900">
                Normal Temperature Range (°C)
              </span>
              <span className="text-xs font-medium text-zinc-600 tabular-nums">
                Current:{' '}
                <strong className="font-bold text-zinc-900">
                  {hasValidSignal && machine.latestTemperatureC !== null
                    ? `${machine.latestTemperatureC.toFixed(1)} °C`
                    : 'No Valid Signal'}
                </strong>
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-3 border-t border-zinc-100">
              <div>
                <div className="text-xs font-medium text-zinc-500">Lower Bound</div>
                <div className="text-xl font-bold text-zinc-900 tabular-nums mt-0.5">
                  {fp.temperatureMinC.toFixed(1)} °C
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-zinc-500">Typical Average</div>
                <div className="text-xl font-bold text-[#D96B27] tabular-nums mt-0.5">
                  {fp.temperatureMeanC.toFixed(1)} °C
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-zinc-500">Upper Ceiling</div>
                <div className="text-xl font-bold text-zinc-900 tabular-nums mt-0.5">
                  {fp.temperatureMaxC.toFixed(1)} °C
                </div>
              </div>
            </div>
          </div>

          {/* Acoustic & Current Reference Row */}
          <div className="bg-white rounded-xl p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <div className="font-bold text-zinc-900">
                Acoustic Reference (MEMS, Simulated)
              </div>
              <div className="text-zinc-600 tabular-nums">
                Envelope {fp.acousticMinDb.toFixed(1)}–{fp.acousticMaxDb.toFixed(1)} dB · Mean{' '}
                {fp.acousticMeanDb.toFixed(1)} dB
              </div>
            </div>
            <div className="space-y-1">
              <div className="font-bold text-zinc-900">
                Load Current Reference (ACS712, Simulated)
              </div>
              <div className="text-zinc-600 tabular-nums">
                Envelope {fp.currentMinAmps.toFixed(1)}–{fp.currentMaxAmps.toFixed(1)} A · Mean{' '}
                {fp.currentMeanAmps.toFixed(1)} A
              </div>
            </div>
          </div>

          {/* Explanation Footer */}
          <div className="px-1 text-xs text-zinc-600 leading-relaxed space-y-1">
            <div className="font-medium text-zinc-800">
              Prototype Note
            </div>
            <p>
              Baselines and health scores shown here are calculated from simulated readings for {machine.name} ({machine.ratedRpm} RPM) using transparent rule-based logic. SANKET+ does not claim trained ML accuracy or validated failure probabilities in this prototype.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

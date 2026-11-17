import {
  AlertSeverity,
  AppSettings,
  HealthStatus,
  Machine,
  MachineHealthMetrics,
  ParameterConditionLevel,
  SensitivityLevel,
  SensorHealth,
  SensorReading,
} from '../types/sanket';

export interface SensitivityRules {
  warningMarginFactor: number;
  criticalMarginFactor: number;
  warningPersistence: number;
  criticalPersistence: number;
  movingAverageWindow: number;
}

export function getSensitivityRules(level: SensitivityLevel): SensitivityRules {
  if (level === 'High') {
    return {
      warningMarginFactor: 0.08,
      criticalMarginFactor: 0.45,
      warningPersistence: 2,
      criticalPersistence: 3,
      movingAverageWindow: 3,
    };
  }
  if (level === 'Low') {
    return {
      warningMarginFactor: 0.25,
      criticalMarginFactor: 0.85,
      warningPersistence: 3,
      criticalPersistence: 5,
      movingAverageWindow: 3,
    };
  }
  return {
    warningMarginFactor: 0.15,
    criticalMarginFactor: 0.65,
    warningPersistence: 2,
    criticalPersistence: 4,
    movingAverageWindow: 3,
  };
}

export interface SimulatedSampleInput {
  vib: number | null;
  temp: number | null;
  acoustic: number | null;
  current: number | null;
  note?: string;
}

export interface EvaluationResult {
  condition: HealthStatus;
  sensorHealth: SensorHealth;
  sensorIssueDetail: string | null;
  summary: string;
  filteredVib: number | null;
  filteredTemp: number | null;
  alertPayload?: {
    alertType: string;
    severity: AlertSeverity;
    triggeringParameter: string;
    observedReading: string;
    thresholdReference: string;
    baselineComparison: string;
    whatChanged: string;
    persistenceSummary: string;
    suggestedInspection: string;
  };
}

/**
 * Modular detector contract so a trained ML classifier/regressor can be swapped
 * in for the rule-based engine in future hardware/data pilots.
 */
export interface AnomalyDetector {
  readonly kind: 'rule-based' | 'ml-model';
  evaluate: (
    machine: Machine,
    sample: SimulatedSampleInput,
    historyIncludingPrev: SensorReading[],
    settings: AppSettings
  ) => EvaluationResult;
}

export function computeMovingAverage(
  values: Array<number | null | undefined>,
  windowSize = 3
): number | null {
  const valid = values
    .slice(-windowSize)
    .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
  if (valid.length === 0) return null;
  const sum = valid.reduce((acc, v) => acc + v, 0);
  return sum / valid.length;
}

export function computeSensorIntegrity(
  vib: number | null,
  temp: number | null,
  acoustic: number | null,
  current: number | null,
  recentReadings: SensorReading[]
): { sensorHealth: SensorHealth; detail: string | null } {
  if (vib === null || temp === null) {
    return {
      sensorHealth: 'SENSOR ISSUE',
      detail:
        'SENSOR DISCONNECTED: Missing sensor packet (null telemetry — missing data is never treated as zero or NORMAL).',
    };
  }
  if (
    Number.isNaN(vib) ||
    Number.isNaN(temp) ||
    vib < 0 ||
    vib > 45 ||
    temp < -20 ||
    temp > 180 ||
    (acoustic !== null && (Number.isNaN(acoustic) || acoustic < 0 || acoustic > 160)) ||
    (current !== null && (Number.isNaN(current) || current < 0 || current > 200))
  ) {
    return {
      sensorHealth: 'SENSOR ISSUE',
      detail: `SENSOR FAULT: Invalid out-of-range telemetry received (vib: ${vib} mm/s, temp: ${temp} °C). Distinguish from mechanical failure.`,
    };
  }

  // Check frozen sensor: 3 consecutive identical readings (previous 2 + current)
  if (recentReadings.length >= 2) {
    const r1 = recentReadings[recentReadings.length - 1];
    const r2 = recentReadings[recentReadings.length - 2];
    if (
      r1.vibrationMmS !== null &&
      r2.vibrationMmS !== null &&
      r1.temperatureC !== null &&
      r2.temperatureC !== null &&
      Math.abs(r1.vibrationMmS - vib) < 0.001 &&
      Math.abs(r2.vibrationMmS - vib) < 0.001 &&
      Math.abs(r1.temperatureC - temp) < 0.01 &&
      Math.abs(r2.temperatureC - temp) < 0.01
    ) {
      return {
        sensorHealth: 'SENSOR ISSUE',
        detail:
          'SENSOR FROZEN: Identical telemetry repeated across 3 consecutive packets. Check edge microcontroller / bus communication.',
      };
    }
  }

  return { sensorHealth: 'Connected', detail: null };
}

export function computeThresholds(machine: Machine, settings: AppSettings) {
  const fp = machine.fingerprint;
  const rules = getSensitivityRules(settings.sensitivity);

  const vibBand = Math.max(0.4, fp.vibrationMaxMmS - fp.vibrationMinMmS);
  const tempBand = Math.max(3.0, fp.temperatureMaxC - fp.temperatureMinC);
  const acousticBand = Math.max(4.0, fp.acousticMaxDb - fp.acousticMinDb);
  const currentBand = Math.max(1.0, fp.currentMaxAmps - fp.currentMinAmps);

  return {
    rules,
    vibWarnThreshold: fp.vibrationMaxMmS + vibBand * rules.warningMarginFactor,
    vibCritThreshold: fp.vibrationMaxMmS + vibBand * rules.criticalMarginFactor,
    tempWarnThreshold: fp.temperatureMaxC + tempBand * rules.warningMarginFactor,
    tempCritThreshold: fp.temperatureMaxC + tempBand * rules.criticalMarginFactor,
    acousticWarnThreshold: fp.acousticMaxDb + acousticBand * rules.warningMarginFactor,
    acousticCritThreshold: fp.acousticMaxDb + acousticBand * rules.criticalMarginFactor,
    currentWarnThreshold: fp.currentMaxAmps + currentBand * rules.warningMarginFactor,
    currentCritThreshold: fp.currentMaxAmps + currentBand * rules.criticalMarginFactor,
  };
}

export function evaluateAnomalyRules(
  machine: Machine,
  sample: SimulatedSampleInput,
  historyIncludingPrev: SensorReading[],
  settings: AppSettings
): EvaluationResult {
  const { vib, temp, acoustic, current } = sample;
  const integrity = computeSensorIntegrity(
    vib,
    temp,
    acoustic,
    current,
    historyIncludingPrev
  );

  if (integrity.sensorHealth === 'SENSOR ISSUE' || vib === null || temp === null) {
    return {
      // Never interpret missing data as NORMAL; preserve CRITICAL if machine already had critical fault, else WARNING
      condition: machine.healthStatus === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
      sensorHealth: 'SENSOR ISSUE',
      sensorIssueDetail: integrity.detail,
      summary: `${integrity.detail ?? 'Telemetry integrity lost.'} Machine condition cannot be verified as NORMAL until sensor connectivity is restored.`,
      filteredVib: null,
      filteredTemp: null,
      alertPayload: {
        alertType: 'Sensor Communication Warning',
        severity: 'Warning',
        triggeringParameter: 'Sensor Signal Integrity (MPU6050 / DS18B20)',
        observedReading:
          vib === null || temp === null
            ? 'Missing packet (null)'
            : `Vib ${vib} mm/s · Temp ${temp} °C`,
        thresholdReference: 'Expected changing numeric stream within valid sensor bounds',
        baselineComparison:
          'Expected valid numeric stream; received missing, frozen, or invalid packet.',
        whatChanged:
          integrity.detail ?? 'Sensor feed stopped delivering valid changing telemetry.',
        persistenceSummary:
          'Immediate signal-integrity flag (distinguished from mechanical machine failure).',
        suggestedInspection:
          'Suggested check: Inspect simulated sensor stream, wiring/bus termination, and ESP32 gateway communication before diagnosing mechanical fault.',
      },
    };
  }

  const fp = machine.fingerprint;
  const {
    rules,
    vibWarnThreshold,
    vibCritThreshold,
    tempWarnThreshold,
    tempCritThreshold,
  } = computeThresholds(machine, settings);

  // Moving-average smoothing across valid historical samples + incoming reading to reject single-sample noise
  const validPrevReadings = historyIncludingPrev.filter(
    (r) => r.sensorHealth === 'Connected'
  );
  const filteredVib =
    computeMovingAverage(
      [...validPrevReadings.map((r) => r.vibrationMmS), vib],
      rules.movingAverageWindow
    ) ?? vib;
  const filteredTemp =
    computeMovingAverage(
      [...validPrevReadings.map((r) => r.temperatureC), temp],
      rules.movingAverageWindow
    ) ?? temp;

  // Instantaneous vs smoothed threshold checks
  const rawVibWarn = vib >= vibWarnThreshold;
  const rawTempWarn = temp >= tempWarnThreshold;
  const isVibWarn = filteredVib >= vibWarnThreshold || (rawVibWarn && validPrevReadings.length === 0);
  const isVibCrit = filteredVib >= vibCritThreshold;
  const isTempWarn = filteredTemp >= tempWarnThreshold || (rawTempWarn && validPrevReadings.length === 0);
  const isTempCrit = filteredTemp >= tempCritThreshold;

  const isAnyRawWarn = rawVibWarn || rawTempWarn;
  const isCombinedWarn = isVibWarn && isTempWarn;

  // Count consecutive historical readings exceeding warning / critical thresholds (persistence check)
  let consecutiveRawWarn = isAnyRawWarn ? 1 : 0;
  if (isAnyRawWarn) {
    for (let i = historyIncludingPrev.length - 1; i >= 0; i--) {
      const r = historyIncludingPrev[i];
      if (r.sensorHealth !== 'Connected' || r.vibrationMmS === null || r.temperatureC === null)
        break;
      const rWarn =
        r.vibrationMmS >= vibWarnThreshold || r.temperatureC >= tempWarnThreshold;
      if (rWarn) consecutiveRawWarn++;
      else break;
    }
  }

  let consecutiveCrit = isVibCrit || isTempCrit ? 1 : 0;
  if (isVibCrit || isTempCrit) {
    for (let i = historyIncludingPrev.length - 1; i >= 0; i--) {
      const r = historyIncludingPrev[i];
      if (r.sensorHealth !== 'Connected' || r.vibrationMmS === null || r.temperatureC === null)
        break;
      const rCrit =
        r.vibrationMmS >= vibCritThreshold || r.temperatureC >= tempCritThreshold;
      if (rCrit) consecutiveCrit++;
      else break;
    }
  }

  let consecutiveCombined = isCombinedWarn ? 1 : 0;
  if (isCombinedWarn) {
    for (let i = historyIncludingPrev.length - 1; i >= 0; i--) {
      const r = historyIncludingPrev[i];
      if (r.sensorHealth !== 'Connected' || r.vibrationMmS === null || r.temperatureC === null)
        break;
      if (
        r.vibrationMmS >= vibWarnThreshold &&
        r.temperatureC >= tempWarnThreshold
      ) {
        consecutiveCombined++;
      } else {
        break;
      }
    }
  }

  const vibPctAboveMean = Math.round(
    ((vib - fp.vibrationMeanMmS) / Math.max(0.1, fp.vibrationMeanMmS)) * 100
  );
  const tempDeltaMean = (temp - fp.temperatureMeanC).toFixed(1);

  const baselineNote =
    fp.status === 'Ready for Monitoring'
      ? ''
      : ' (evaluating against demonstration reference while baseline verification is pending)';

  // 1. CRITICAL via correlated vib+temp deviation OR sustained critical elevation
  const correlatedTrigger =
    settings.correlateVibAndTemp &&
    consecutiveCombined >= Math.max(2, rules.warningPersistence);
  const sustainedCritTrigger =
    settings.warningEscalation && consecutiveCrit >= rules.criticalPersistence;

  if (correlatedTrigger || sustainedCritTrigger) {
    const paramLabel =
      isVibWarn && isTempWarn
        ? 'Vibration RMS (mm/s) & Temperature (°C)'
        : isVibCrit
        ? 'Vibration RMS (mm/s)'
        : 'Operating Temperature (°C)';

    const observedReading = [
      isVibWarn ? `${vib.toFixed(2)} mm/s (avg ${filteredVib.toFixed(2)})` : null,
      isTempWarn ? `${temp.toFixed(1)} °C (avg ${filteredTemp.toFixed(1)})` : null,
    ]
      .filter(Boolean)
      .join(' · ');

    const thresholdRef = [
      isVibWarn
        ? `Vib Warn ${vibWarnThreshold.toFixed(2)} / Crit ${vibCritThreshold.toFixed(2)} mm/s`
        : null,
      isTempWarn
        ? `Temp Warn ${tempWarnThreshold.toFixed(1)} / Crit ${tempCritThreshold.toFixed(1)} °C`
        : null,
    ]
      .filter(Boolean)
      .join(' · ');

    const comparison = [
      isVibWarn
        ? `Vibration ${vib.toFixed(2)} mm/s (3-pt avg ${filteredVib.toFixed(2)} mm/s) vs baseline mean ${fp.vibrationMeanMmS.toFixed(2)} mm/s (+${vibPctAboveMean}%, ceiling ${fp.vibrationMaxMmS.toFixed(2)} mm/s)`
        : null,
      isTempWarn
        ? `Temperature ${temp.toFixed(1)} °C (3-pt avg ${filteredTemp.toFixed(1)} °C) vs baseline mean ${fp.temperatureMeanC.toFixed(1)} °C (+${tempDeltaMean} °C, ceiling ${fp.temperatureMaxC.toFixed(1)} °C)`
        : null,
    ]
      .filter(Boolean)
      .join('; ');

    const inspectionText =
      isVibWarn && isTempWarn
        ? 'Recommended immediate inspection: Check bearings, shaft mounting and alignment, lubrication condition, cooling airflow, and motor load.'
        : isVibCrit
        ? 'Recommended immediate inspection: Inspect bearings, mounting fasteners, coupling balance, and shaft alignment for mechanical wear or looseness.'
        : 'Recommended immediate inspection: Check cooling airflow, lubrication integrity, ambient heat dissipation, and motor load.';

    return {
      condition: 'CRITICAL',
      sensorHealth: 'Connected',
      sensorIssueDetail: null,
      filteredVib,
      filteredTemp,
      summary: `${
        correlatedTrigger
          ? 'Correlated vibration and temperature anomalies detected concurrently'
          : 'Sustained high deviation'
      } exceeded critical rule thresholds${baselineNote}.`,
      alertPayload: {
        alertType: correlatedTrigger
          ? 'Combined Anomaly (Correlated)'
          : isVibCrit
          ? 'Critical Vibration Escalation'
          : 'Critical Overheating',
        severity: 'Critical',
        triggeringParameter: paramLabel,
        observedReading,
        thresholdReference: thresholdRef,
        baselineComparison: comparison,
        whatChanged: correlatedTrigger
          ? 'Both filtered vibration and operating temperature rose concurrently above warning thresholds, indicating compounding mechanical-thermal stress.'
          : isVibCrit
          ? `Filtered vibration climbed to ${filteredVib.toFixed(2)} mm/s (raw ${vib.toFixed(2)} mm/s) and remained above the critical threshold.`
          : `Filtered temperature climbed to ${filteredTemp.toFixed(1)} °C (raw ${temp.toFixed(1)} °C) and remained above the critical threshold.`,
        persistenceSummary: correlatedTrigger
          ? `Persistent across ${consecutiveCombined} consecutive readings with vibration-temperature correlation enabled.`
          : `Persistent across ${consecutiveCrit} consecutive readings (threshold: ${rules.criticalPersistence} samples).`,
        suggestedInspection: inspectionText,
      },
    };
  }

  // 2. WARNING via persistent smoothed deviation
  if (
    (isVibWarn || isTempWarn) &&
    consecutiveRawWarn >= rules.warningPersistence
  ) {
    const paramLabel =
      isVibWarn && isTempWarn
        ? 'Vibration RMS (mm/s) & Temperature (°C)'
        : isVibWarn
        ? 'Vibration RMS (mm/s)'
        : 'Operating Temperature (°C)';

    const observedReading = [
      isVibWarn ? `${vib.toFixed(2)} mm/s (avg ${filteredVib.toFixed(2)})` : null,
      isTempWarn ? `${temp.toFixed(1)} °C (avg ${filteredTemp.toFixed(1)})` : null,
    ]
      .filter(Boolean)
      .join(' · ');

    const thresholdRef = [
      isVibWarn ? `Warn ≥ ${vibWarnThreshold.toFixed(2)} mm/s (baseline max ${fp.vibrationMaxMmS.toFixed(2)})` : null,
      isTempWarn ? `Warn ≥ ${tempWarnThreshold.toFixed(1)} °C (baseline max ${fp.temperatureMaxC.toFixed(1)})` : null,
    ]
      .filter(Boolean)
      .join(' · ');

    const comparison = [
      isVibWarn
        ? `Vibration ${vib.toFixed(2)} mm/s (3-pt avg ${filteredVib.toFixed(2)} mm/s) vs baseline ceiling ${fp.vibrationMaxMmS.toFixed(2)} mm/s (+${vibPctAboveMean}% above mean)`
        : null,
      isTempWarn
        ? `Temperature ${temp.toFixed(1)} °C (3-pt avg ${filteredTemp.toFixed(1)} °C) vs baseline ceiling ${fp.temperatureMaxC.toFixed(1)} °C (+${tempDeltaMean} °C above mean)`
        : null,
    ]
      .filter(Boolean)
      .join('; ');

    return {
      condition: 'WARNING',
      sensorHealth: 'Connected',
      sensorIssueDetail: null,
      filteredVib,
      filteredTemp,
      summary: `Persistent deviation detected across ${consecutiveRawWarn} readings (3-sample average: ${filteredVib.toFixed(2)} mm/s, ${filteredTemp.toFixed(1)} °C)${baselineNote}.`,
      alertPayload: {
        alertType:
          isVibWarn && isTempWarn
            ? 'Combined Early Drift Warning'
            : isVibWarn
            ? 'Vibration Drift Warning'
            : 'Thermal Drift Warning',
        severity: 'Warning',
        triggeringParameter: paramLabel,
        observedReading,
        thresholdReference: thresholdRef,
        baselineComparison: comparison,
        whatChanged:
          isVibWarn && isTempWarn
            ? `Simulated vibration (${vib.toFixed(2)} mm/s) and temperature (${temp.toFixed(1)} °C) drifted above baseline ceilings.`
            : isVibWarn
            ? `Simulated vibration rose to ${vib.toFixed(2)} mm/s (filtered ${filteredVib.toFixed(2)} mm/s) above the warning threshold.`
            : `Simulated temperature rose to ${temp.toFixed(1)} °C (filtered ${filteredTemp.toFixed(1)} °C) above the warning threshold.`,
        persistenceSummary: `Persistent across ${consecutiveRawWarn} consecutive readings (sensitivity: ${settings.sensitivity}).`,
        suggestedInspection: isVibWarn && isTempWarn
          ? 'Recommended inspection: Inspect bearings, mounting, shaft alignment, cooling airflow, lubrication, and motor load.'
          : isVibWarn
          ? 'Recommended inspection: Inspect bearings, mounting fasteners, and shaft alignment for early wear or imbalance.'
          : 'Recommended inspection: Check cooling airflow, lubrication level, and motor load.',
      },
    };
  }

  // 3. Single transient spike — hold at NORMAL pending persistence check (do NOT raise premature alert)
  if (isAnyRawWarn && consecutiveRawWarn === 1) {
    return {
      condition: 'NORMAL',
      sensorHealth: 'Connected',
      sensorIssueDetail: null,
      filteredVib,
      filteredTemp,
      summary: `Single transient reading (${vib.toFixed(2)} mm/s · ${temp.toFixed(1)} °C) outside baseline; holding at NORMAL while moving-average filter (${filteredVib.toFixed(2)} mm/s) and persistence check confirm whether elevation continues.`,
    };
  }

  // 4. Recovery after a single isolated spike — log Info notice proving false alarm was prevented
  const prevReading = historyIncludingPrev[historyIncludingPrev.length - 1];
  const prevWasIsolatedSpike =
    !isAnyRawWarn &&
    prevReading &&
    prevReading.sensorHealth === 'Connected' &&
    prevReading.machineCondition === 'NORMAL' &&
    prevReading.vibrationMmS !== null &&
    prevReading.temperatureC !== null &&
    (prevReading.vibrationMmS >= vibWarnThreshold ||
      prevReading.temperatureC >= tempWarnThreshold);

  if (prevWasIsolatedSpike && prevReading.vibrationMmS !== null && prevReading.temperatureC !== null) {
    const spikeWasVib = prevReading.vibrationMmS >= vibWarnThreshold;
    return {
      condition: 'NORMAL',
      sensorHealth: 'Connected',
      sensorIssueDetail: null,
      filteredVib,
      filteredTemp,
      summary: `Temporary fluctuation (${prevReading.vibrationMmS.toFixed(2)} mm/s · ${prevReading.temperatureC.toFixed(1)} °C) subsided back within baseline. Moving-average & persistence checks prevented a false alarm.`,
      alertPayload: {
        alertType: 'Transient Fluctuation Filtered',
        severity: 'Info',
        triggeringParameter: spikeWasVib ? 'Vibration RMS (mm/s)' : 'Operating Temperature (°C)',
        observedReading: `Peak ${prevReading.vibrationMmS.toFixed(2)} mm/s → returned to ${vib.toFixed(2)} mm/s`,
        thresholdReference: `Persistence requires ${rules.warningPersistence} consecutive readings ≥ ${vibWarnThreshold.toFixed(2)} mm/s / ${tempWarnThreshold.toFixed(1)} °C`,
        baselineComparison: `Brief spike (${prevReading.vibrationMmS.toFixed(2)} mm/s · ${prevReading.temperatureC.toFixed(1)} °C) returned inside baseline (${fp.vibrationMaxMmS.toFixed(2)} mm/s · ${fp.temperatureMaxC.toFixed(1)} °C).`,
        whatChanged:
          'One short-lived simulated spike crossed the baseline ceiling and immediately returned to normal.',
        persistenceSummary: `Non-persistent (1 of ${rules.warningPersistence} required readings). Filtered out without triggering WARNING or CRITICAL escalation.`,
        suggestedInspection:
          'No immediate action required; persistence and moving-average filtering suppressed false alarm.',
      },
    };
  }

  return {
    condition: 'NORMAL',
    sensorHealth: 'Connected',
    sensorIssueDetail: null,
    filteredVib,
    filteredTemp,
    summary: `Operating within learned baseline envelope (${fp.vibrationMinMmS.toFixed(2)}–${fp.vibrationMaxMmS.toFixed(2)} mm/s, ${fp.temperatureMinC.toFixed(1)}–${fp.temperatureMaxC.toFixed(1)} °C)${baselineNote}.`,
  };
}

export const ruleBasedAnomalyDetector: AnomalyDetector = {
  kind: 'rule-based',
  evaluate: evaluateAnomalyRules,
};

/**
 * Single centralized calculation for illustrative Health Score (0-100),
 * risk classification, parameter conditions, and abnormal explanation.
 * Read by Overview, Machines, Health Fingerprint, Live Monitoring, and Simulation Lab.
 */
export function computeMachineHealthMetrics(
  machine: Machine,
  settings: AppSettings
): MachineHealthMetrics {
  const fp = machine.fingerprint;
  const {
    vibWarnThreshold,
    vibCritThreshold,
    tempWarnThreshold,
    tempCritThreshold,
    acousticWarnThreshold,
    acousticCritThreshold,
    currentWarnThreshold,
    currentCritThreshold,
    rules,
  } = computeThresholds(machine, settings);

  const hasValidSignal =
    machine.sensorHealth === 'Connected' &&
    machine.latestVibrationMmS !== null &&
    machine.latestTemperatureC !== null;

  if (!hasValidSignal || machine.latestVibrationMmS === null || machine.latestTemperatureC === null) {
    return {
      healthScore: null,
      deviationPercent: 100,
      riskClassification: 'Unverified (Sensor Disconnected)',
      filteredVibrationMmS: null,
      filteredTemperatureC: null,
      filteredAcousticDb: null,
      filteredCurrentAmps: null,
      vibrationStatus: 'No Signal',
      temperatureStatus: 'No Signal',
      acousticStatus: 'No Signal',
      currentStatus: 'No Signal',
      vibrationDeviationPct: null,
      temperatureDeltaC: null,
      acousticDeltaDb: null,
      currentDeviationPct: null,
      abnormalParametersExplanation:
        machine.sensorIssueDetail ??
        'Sensor telemetry is missing, frozen, or invalid. Re-establish valid sensor communication before evaluating machine health.',
    };
  }

  const validReadings = machine.readings.filter((r) => r.sensorHealth === 'Connected');
  const filteredVib =
    computeMovingAverage(
      validReadings.map((r) => r.vibrationMmS),
      rules.movingAverageWindow
    ) ?? machine.latestVibrationMmS;
  const filteredTemp =
    computeMovingAverage(
      validReadings.map((r) => r.temperatureC),
      rules.movingAverageWindow
    ) ?? machine.latestTemperatureC;
  const filteredAcoustic =
    computeMovingAverage(
      validReadings.map((r) => r.acousticDb),
      rules.movingAverageWindow
    ) ?? machine.latestAcousticDb;
  const filteredCurrent =
    computeMovingAverage(
      validReadings.map((r) => r.currentAmps),
      rules.movingAverageWindow
    ) ?? machine.latestCurrentAmps;

  const vibDevPct = Math.round(
    ((machine.latestVibrationMmS - fp.vibrationMeanMmS) /
      Math.max(0.1, fp.vibrationMeanMmS)) *
      100
  );
  const tempDeltaC = Number(
    (machine.latestTemperatureC - fp.temperatureMeanC).toFixed(1)
  );
  const acousticDeltaDb =
    machine.latestAcousticDb !== null
      ? Number((machine.latestAcousticDb - fp.acousticMeanDb).toFixed(1))
      : null;
  const currentDevPct =
    machine.latestCurrentAmps !== null
      ? Math.round(
          ((machine.latestCurrentAmps - fp.currentMeanAmps) /
            Math.max(0.2, fp.currentMeanAmps)) *
            100
        )
      : null;

  const classifyParam = (
    val: number | null,
    warn: number,
    crit: number
  ): ParameterConditionLevel => {
    if (val === null) return 'No Signal';
    if (val >= crit) return 'Critical';
    if (val >= warn) return 'Elevated';
    return 'Normal';
  };

  const vibrationStatus = classifyParam(
    filteredVib,
    vibWarnThreshold,
    vibCritThreshold
  );
  const temperatureStatus = classifyParam(
    filteredTemp,
    tempWarnThreshold,
    tempCritThreshold
  );
  const acousticStatus = classifyParam(
    filteredAcoustic,
    acousticWarnThreshold,
    acousticCritThreshold
  );
  const currentStatus = classifyParam(
    filteredCurrent,
    currentWarnThreshold,
    currentCritThreshold
  );

  // Illustrative Health Score (100 = centered on baseline, drops smoothly with parameter deviations and escalated state)
  const vibPenalty =
    Math.max(0, (filteredVib - fp.vibrationMaxMmS) / Math.max(0.25, fp.vibrationMaxMmS - fp.vibrationMinMmS)) *
    28;
  const tempPenalty =
    Math.max(0, (filteredTemp - fp.temperatureMaxC) / Math.max(2.0, fp.temperatureMaxC - fp.temperatureMinC)) *
    26;
  const acousticPenalty =
    filteredAcoustic !== null
      ? Math.max(0, (filteredAcoustic - fp.acousticMaxDb) / Math.max(3.0, fp.acousticMaxDb - fp.acousticMinDb)) *
        10
      : 0;
  const currentPenalty =
    filteredCurrent !== null
      ? Math.max(0, (filteredCurrent - fp.currentMaxAmps) / Math.max(0.8, fp.currentMaxAmps - fp.currentMinAmps)) *
        10
      : 0;

  let rawScore = Math.round(
    100 - vibPenalty - tempPenalty - acousticPenalty - currentPenalty
  );

  // Keep score aligned with persistent machine condition
  if (machine.healthStatus === 'CRITICAL') {
    rawScore = Math.min(rawScore, 44);
  } else if (machine.healthStatus === 'WARNING') {
    rawScore = Math.min(rawScore, 78);
  } else {
    rawScore = Math.max(rawScore, 84);
  }

  const healthScore = Math.min(100, Math.max(12, rawScore));
  const deviationPercent = Math.min(95, Math.max(0, 100 - healthScore));

  const riskClassification: MachineHealthMetrics['riskClassification'] =
    machine.healthStatus === 'CRITICAL'
      ? 'High Risk (Critical)'
      : machine.healthStatus === 'WARNING'
      ? 'Moderate Risk (Warning)'
      : 'Low Risk (Nominal)';

  const abnormalParts: string[] = [];
  if (vibrationStatus !== 'Normal') {
    abnormalParts.push(
      `Vibration is ${vibrationStatus.toLowerCase()} at ${machine.latestVibrationMmS.toFixed(2)} mm/s (3-pt avg ${filteredVib.toFixed(2)} mm/s vs baseline max ${fp.vibrationMaxMmS.toFixed(2)} mm/s).`
    );
  }
  if (temperatureStatus !== 'Normal') {
    abnormalParts.push(
      `Temperature is ${temperatureStatus.toLowerCase()} at ${machine.latestTemperatureC.toFixed(1)} °C (3-pt avg ${filteredTemp.toFixed(1)} °C vs baseline max ${fp.temperatureMaxC.toFixed(1)} °C).`
    );
  }
  if (acousticStatus !== 'Normal' && machine.latestAcousticDb !== null) {
    abnormalParts.push(
      `Simulated acoustic level is ${acousticStatus.toLowerCase()} at ${machine.latestAcousticDb.toFixed(1)} dB (baseline max ${fp.acousticMaxDb.toFixed(1)} dB).`
    );
  }
  if (currentStatus !== 'Normal' && machine.latestCurrentAmps !== null) {
    abnormalParts.push(
      `Simulated motor current is ${currentStatus.toLowerCase()} at ${machine.latestCurrentAmps.toFixed(1)} A (baseline max ${fp.currentMaxAmps.toFixed(1)} A).`
    );
  }

  const abnormalParametersExplanation =
    abnormalParts.length > 0
      ? abnormalParts.join(' ')
      : machine.statusSummary;

  return {
    healthScore,
    deviationPercent,
    riskClassification,
    filteredVibrationMmS: Number(filteredVib.toFixed(2)),
    filteredTemperatureC: Number(filteredTemp.toFixed(1)),
    filteredAcousticDb:
      filteredAcoustic !== null ? Number(filteredAcoustic.toFixed(1)) : null,
    filteredCurrentAmps:
      filteredCurrent !== null ? Number(filteredCurrent.toFixed(1)) : null,
    vibrationStatus,
    temperatureStatus,
    acousticStatus,
    currentStatus,
    vibrationDeviationPct: vibDevPct,
    temperatureDeltaC: tempDeltaC,
    acousticDeltaDb,
    currentDeviationPct: currentDevPct,
    abnormalParametersExplanation,
  };
}

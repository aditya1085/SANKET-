import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  createInitialAlerts,
  createInitialMachines,
  createResetMachines,
  DEFAULT_SETTINGS,
} from '../data/initialData';
import {
  computeMachineHealthMetrics,
  getSensitivityRules,
  ruleBasedAnomalyDetector,
} from '../engine/anomalyEngine';
import { generateNextScenarioValues } from '../engine/simulationEngine';
import {
  AlertEvent,
  AlertStatus,
  AppSettings,
  Machine,
  MachineHealthMetrics,
  NavigationPage,
  SensorFaultMode,
  SensorReading,
  SimulationScenarioId,
} from '../types/sanket';

export { getSensitivityRules };

const STORAGE_KEY = 'sanket_plus_state_v2';

interface PersistedState {
  machines: Machine[];
  alerts: AlertEvent[];
  settings: AppSettings;
}

export interface SummaryCounts {
  totalMachines: number;
  healthy: number;
  warning: number;
  critical: number;
  sensorIssue: number;
  underObservation: number;
  fleetHealthScore: number;
  activeAlerts: number;
}

interface SanketContextValue {
  activePage: NavigationPage;
  setActivePage: (page: NavigationPage) => void;
  selectedMachineId: string;
  setSelectedMachineId: (id: string) => void;
  detailMachineId: string | null;
  openMachineDetails: (id: string) => void;
  closeMachineDetails: () => void;
  machines: Machine[];
  alerts: AlertEvent[];
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;
  summaryCounts: SummaryCounts;
  healthMetricsByMachine: Record<string, MachineHealthMetrics>;
  isMonitoring: boolean;
  startMonitoring: () => void;
  stopMonitoring: () => void;
  sampleIntervalMs: number;
  setSampleIntervalMs: (ms: number) => void;
  stepSimulatedSample: (targetMachineId?: string) => void;
  startScenario: (
    machineId: string,
    scenario: SimulationScenarioId,
    faultMode?: SensorFaultMode
  ) => void;
  pauseScenario: (machineId: string) => void;
  resumeScenario: (machineId: string) => void;
  stopScenario: (machineId: string) => void;
  restartScenario: (machineId: string) => void;
  resetMachineScenario: (machineId: string) => void;
  setMachineFaultMode: (machineId: string, mode: SensorFaultMode) => void;
  acknowledgeAlert: (alertId: string) => void;
  resolveAlert: (alertId: string) => void;
  clearAlertHistory: () => void;
  confirmMachineHealthy: (machineId: string) => { ok: boolean; message: string };
  startBaselineLearning: (machineId: string) => { ok: boolean; message: string };
  captureLearningSample: (machineId: string) => void;
  completeBaseline: (machineId: string) => { ok: boolean; message: string };
  resetBaseline: (machineId: string) => void;
  resetDemoData: () => void;
  actionFeedback: { type: 'info' | 'success' | 'warning'; text: string } | null;
  clearActionFeedback: () => void;
}

const SanketContext = createContext<SanketContextValue | null>(null);

function hydrateMachine(raw: Machine, fallback: Machine): Machine {
  return {
    ...fallback,
    ...raw,
    scenarioRunning: false,
    scenarioPaused: Boolean(raw.scenarioPaused && raw.scenarioStep > 0),
    latestAcousticDb:
      raw.latestAcousticDb !== undefined
        ? raw.latestAcousticDb
        : fallback.latestAcousticDb,
    latestCurrentAmps:
      raw.latestCurrentAmps !== undefined
        ? raw.latestCurrentAmps
        : fallback.latestCurrentAmps,
    fingerprint: {
      ...fallback.fingerprint,
      ...(raw.fingerprint ?? {}),
      learningBufferAcoustic: raw.fingerprint?.learningBufferAcoustic ?? [],
      learningBufferCurrent: raw.fingerprint?.learningBufferCurrent ?? [],
    },
    readings: Array.isArray(raw.readings)
      ? raw.readings.map((r) => ({
          ...r,
          acousticDb:
            r.acousticDb !== undefined
              ? r.acousticDb
              : fallback.fingerprint.acousticMeanDb,
          currentAmps:
            r.currentAmps !== undefined
              ? r.currentAmps
              : fallback.fingerprint.currentMeanAmps,
        }))
      : fallback.readings,
  };
}

function hydrateAlert(raw: AlertEvent): AlertEvent {
  return {
    ...raw,
    observedReading: raw.observedReading ?? raw.baselineComparison,
    thresholdReference: raw.thresholdReference ?? 'Configured baseline envelope',
    occurrenceCount: raw.occurrenceCount ?? 1,
  };
}

function loadPersistedState(): PersistedState {
  const defaults = createInitialMachines();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        machines: defaults,
        alerts: createInitialAlerts(),
        settings: DEFAULT_SETTINGS,
      };
    }
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    if (!Array.isArray(parsed.machines) || parsed.machines.length === 0) {
      throw new Error('Invalid persisted machines');
    }
    const sanitizedMachines = parsed.machines.map((m, idx) =>
      hydrateMachine(m, defaults[idx] ?? defaults[0])
    );
    return {
      machines: sanitizedMachines,
      alerts: Array.isArray(parsed.alerts)
        ? parsed.alerts.map(hydrateAlert)
        : createInitialAlerts(),
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    };
  } catch {
    return {
      machines: defaults,
      alerts: createInitialAlerts(),
      settings: DEFAULT_SETTINGS,
    };
  }
}

function nextAlertSequence(alerts: AlertEvent[]): number {
  let maxNum = 1042;
  for (const a of alerts) {
    const match = /^ALT-(\d+)$/.exec(a.id);
    if (match) {
      const n = Number(match[1]);
      if (!Number.isNaN(n) && n > maxNum) maxNum = n;
    }
  }
  return maxNum + 1;
}

export const SanketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initial = useMemo(() => loadPersistedState(), []);

  const [machines, setMachines] = useState<Machine[]>(initial.machines);
  const [alerts, setAlerts] = useState<AlertEvent[]>(initial.alerts);
  const [settings, setSettings] = useState<AppSettings>(initial.settings);

  const [activePage, setActivePageState] = useState<NavigationPage>('overview');
  const [selectedMachineId, setSelectedMachineId] = useState<string>(
    initial.machines[0]?.id ?? 'PUMP-001'
  );
  const [detailMachineId, setDetailMachineId] = useState<string | null>(null);
  const [isMonitoring, setIsMonitoring] = useState<boolean>(false);
  const [sampleIntervalMs, setSampleIntervalMs] = useState<number>(1500);
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'info' | 'success' | 'warning';
    text: string;
  } | null>(null);

  const pendingScenarioTimeoutRef = useRef<number | null>(null);
  const alertCounterRef = useRef<number>(nextAlertSequence(initial.alerts));

  const clearPendingScenarioTimeout = useCallback(() => {
    if (pendingScenarioTimeoutRef.current !== null) {
      window.clearTimeout(pendingScenarioTimeoutRef.current);
      pendingScenarioTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearPendingScenarioTimeout();
    };
  }, [clearPendingScenarioTimeout]);

  const showFeedback = useCallback(
    (type: 'info' | 'success' | 'warning', text: string) => {
      setActionFeedback({ type, text });
    },
    []
  );

  const clearActionFeedback = useCallback(() => {
    setActionFeedback(null);
  }, []);

  useEffect(() => {
    try {
      const payload: PersistedState = { machines, alerts, settings };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }, [machines, alerts, settings]);

  const setActivePage = useCallback((page: NavigationPage) => {
    setActivePageState(page);
    if (page !== 'machines') {
      setDetailMachineId(null);
    }
  }, []);

  const openMachineDetails = useCallback((id: string) => {
    setSelectedMachineId(id);
    setDetailMachineId(id);
    setActivePageState('machines');
  }, []);

  const closeMachineDetails = useCallback(() => {
    setDetailMachineId(null);
  }, []);

  const updateSettings = useCallback(
    (partial: Partial<AppSettings>) => {
      setSettings((prev) => ({ ...prev, ...partial }));
      if (partial.sensitivity) {
        showFeedback(
          'info',
          `Monitoring sensitivity updated to ${partial.sensitivity}.`
        );
      }
    },
    [showFeedback]
  );

  const appendOrGroupAlerts = useCallback((newEvents: AlertEvent[]) => {
    if (newEvents.length === 0) return;
    setAlerts((prev) => {
      let next = [...prev];
      for (const ev of newEvents) {
        // If escalating to Critical on a machine, mark prior active Warnings for that machine Resolved
        if (ev.severity === 'Critical') {
          next = next.map((existing) =>
            existing.machineId === ev.machineId &&
            existing.status === 'Active' &&
            existing.severity === 'Warning'
              ? { ...existing, status: 'Resolved' as AlertStatus }
              : existing
          );
        }

        // Group repeated detections of same machine + severity + alertType into the existing active event
        const existingIdx = next.findIndex(
          (existing) =>
            existing.machineId === ev.machineId &&
            existing.status === 'Active' &&
            existing.severity === ev.severity &&
            existing.alertType === ev.alertType
        );

        if (existingIdx >= 0) {
          const existing = next[existingIdx];
          const count = (existing.occurrenceCount ?? 1) + 1;
          next[existingIdx] = {
            ...existing,
            timestamp: ev.timestamp,
            observedReading: ev.observedReading,
            baselineComparison: ev.baselineComparison,
            whatChanged: ev.whatChanged,
            persistenceSummary: `${ev.persistenceSummary} (Grouped ${count} detections)`,
            occurrenceCount: count,
          };
        } else {
          // Also avoid duplicate consecutive Info notices within 15 seconds for same machine + type
          const recentInfoDup =
            ev.severity === 'Info' &&
            next.some(
              (existing) =>
                existing.machineId === ev.machineId &&
                existing.alertType === ev.alertType &&
                Math.abs(
                  new Date(ev.timestamp).getTime() -
                    new Date(existing.timestamp).getTime()
                ) < 15_000
            );
          if (!recentInfoDup) {
            next.unshift(ev);
          }
        }
      }
      return next.slice(0, 100);
    });
  }, []);

  const processMachineTick = useCallback(
    (targetMachineId?: string, forceAllRunning = false) => {
      const nowIso = new Date().toISOString();
      const createdAlerts: AlertEvent[] = [];

      setMachines((prevMachines) =>
        prevMachines.map((machine) => {
          const shouldStep = targetMachineId
            ? machine.id === targetMachineId
            : isMonitoring ||
              (forceAllRunning && machine.scenarioRunning) ||
              machine.scenarioRunning;

          if (!shouldStep) return machine;

          const nextStep = machine.scenarioStep + 1;
          const generated = generateNextScenarioValues(machine, nextStep);

          const evaluation = ruleBasedAnomalyDetector.evaluate(
            machine,
            generated,
            machine.readings,
            settings
          );

          if (evaluation.alertPayload) {
            const sev = evaluation.alertPayload.severity;
            const status: AlertStatus = sev === 'Info' ? 'Acknowledged' : 'Active';
            const seq = alertCounterRef.current++;
            createdAlerts.push({
              id: `ALT-${seq}`,
              timestamp: nowIso,
              machineId: machine.id,
              machineName: machine.name,
              alertType: evaluation.alertPayload.alertType,
              severity: sev,
              triggeringParameter: evaluation.alertPayload.triggeringParameter,
              observedReading: evaluation.alertPayload.observedReading,
              thresholdReference: evaluation.alertPayload.thresholdReference,
              baselineComparison: evaluation.alertPayload.baselineComparison,
              whatChanged: evaluation.alertPayload.whatChanged,
              persistenceSummary: evaluation.alertPayload.persistenceSummary,
              suggestedInspection: evaluation.alertPayload.suggestedInspection,
              reason: `${evaluation.alertPayload.whatChanged} (${evaluation.alertPayload.persistenceSummary})`,
              status,
              occurrenceCount: 1,
              isSimulated: true,
            });
          }

          const nextAccel =
            generated.vib !== null && evaluation.sensorHealth === 'Connected'
              ? Number((generated.vib * 0.14 + 0.08).toFixed(2))
              : null;

          const newReading: SensorReading = {
            timestamp: nowIso,
            vibrationMmS: generated.vib,
            temperatureC: generated.temp,
            acousticDb:
              evaluation.sensorHealth === 'Connected' ? generated.acoustic : null,
            currentAmps:
              evaluation.sensorHealth === 'Connected' ? generated.current : null,
            peakAccelG: nextAccel,
            sensorHealth: evaluation.sensorHealth,
            machineCondition: evaluation.condition,
            rawNote: generated.note,
            isSimulated: true,
          };

          // Baseline learning progression (NEVER auto-approves; NEVER learns when abnormal or sensor issue)
          let updatedFp = machine.fingerprint;
          if (updatedFp.status === 'Learning in Progress') {
            if (
              evaluation.sensorHealth !== 'Connected' ||
              evaluation.condition !== 'NORMAL'
            ) {
              updatedFp = {
                ...updatedFp,
                status: 'Requires Verification',
                healthyConfirmed: false,
                confirmedBy: 'Paused due to abnormal sample',
                lastUpdated: nowIso,
              };
            } else if (
              generated.vib !== null &&
              generated.temp !== null &&
              generated.acoustic !== null &&
              generated.current !== null
            ) {
              const bufVib = [...updatedFp.learningBufferVib, generated.vib];
              const bufTemp = [...updatedFp.learningBufferTemp, generated.temp];
              const bufAcoustic = [
                ...updatedFp.learningBufferAcoustic,
                generated.acoustic,
              ];
              const bufCurrent = [
                ...updatedFp.learningBufferCurrent,
                generated.current,
              ];
              const collected = Math.min(updatedFp.samplesRequired, bufVib.length);
              const progress = Math.round(
                (collected / updatedFp.samplesRequired) * 100
              );
              const done = collected >= updatedFp.samplesRequired;

              const mean = (arr: number[]) =>
                arr.reduce((s, v) => s + v, 0) / Math.max(1, arr.length);

              updatedFp = {
                ...updatedFp,
                learningBufferVib: bufVib,
                learningBufferTemp: bufTemp,
                learningBufferAcoustic: bufAcoustic,
                learningBufferCurrent: bufCurrent,
                samplesCollected: collected,
                learningProgress: progress,
                vibrationMinMmS: Number(
                  Math.max(0.2, Math.min(...bufVib) - 0.15).toFixed(2)
                ),
                vibrationMaxMmS: Number((Math.max(...bufVib) + 0.25).toFixed(2)),
                vibrationMeanMmS: Number(mean(bufVib).toFixed(2)),
                temperatureMinC: Number((Math.min(...bufTemp) - 1.5).toFixed(1)),
                temperatureMaxC: Number((Math.max(...bufTemp) + 2.0).toFixed(1)),
                temperatureMeanC: Number(mean(bufTemp).toFixed(1)),
                acousticMinDb: Number((Math.min(...bufAcoustic) - 2.0).toFixed(1)),
                acousticMaxDb: Number((Math.max(...bufAcoustic) + 2.5).toFixed(1)),
                acousticMeanDb: Number(mean(bufAcoustic).toFixed(1)),
                currentMinAmps: Number(
                  Math.max(0.5, Math.min(...bufCurrent) - 0.6).toFixed(1)
                ),
                currentMaxAmps: Number((Math.max(...bufCurrent) + 0.8).toFixed(1)),
                currentMeanAmps: Number(mean(bufCurrent).toFixed(1)),
                status: done ? 'Requires Verification' : 'Learning in Progress',
                isDemonstrationBaseline: false,
                lastUpdated: nowIso,
              };
            }
          }

          return {
            ...machine,
            scenarioStep: nextStep,
            healthStatus: evaluation.condition,
            sensorHealth: evaluation.sensorHealth,
            sensorIssueDetail: evaluation.sensorIssueDetail,
            statusSummary: evaluation.summary,
            latestVibrationMmS: generated.vib,
            latestTemperatureC: generated.temp,
            latestAcousticDb:
              evaluation.sensorHealth === 'Connected' ? generated.acoustic : null,
            latestCurrentAmps:
              evaluation.sensorHealth === 'Connected' ? generated.current : null,
            latestPeakAccelG: nextAccel,
            lastUpdated: nowIso,
            fingerprint: updatedFp,
            readings: [...machine.readings.slice(-29), newReading],
          };
        })
      );

      if (createdAlerts.length > 0) {
        appendOrGroupAlerts(createdAlerts);
      }
    },
    [appendOrGroupAlerts, isMonitoring, settings]
  );

  // Single guarded timer — prevents duplicate intervals and memory leaks
  const anyScenarioRunning = useMemo(
    () => machines.some((m) => m.scenarioRunning),
    [machines]
  );

  useEffect(() => {
    if (!isMonitoring && !anyScenarioRunning) {
      return;
    }
    const timerId = window.setInterval(() => {
      processMachineTick(undefined, true);
    }, sampleIntervalMs);
    return () => {
      window.clearInterval(timerId);
    };
  }, [isMonitoring, anyScenarioRunning, sampleIntervalMs, processMachineTick]);

  const startMonitoring = useCallback(() => {
    setIsMonitoring(true);
    showFeedback(
      'success',
      `Live simulated monitoring started (${(sampleIntervalMs / 1000).toFixed(1)}s cadence).`
    );
  }, [sampleIntervalMs, showFeedback]);

  const stopMonitoring = useCallback(() => {
    clearPendingScenarioTimeout();
    setIsMonitoring(false);
    setMachines((prev) =>
      prev.map((m) => ({
        ...m,
        scenarioRunning: false,
        scenarioPaused: m.scenarioRunning ? true : m.scenarioPaused,
      }))
    );
    showFeedback('info', 'Simulated monitoring and active scenario timers stopped.');
  }, [clearPendingScenarioTimeout, showFeedback]);

  const stepSimulatedSample = useCallback(
    (targetMachineId?: string) => {
      processMachineTick(targetMachineId, false);
    },
    [processMachineTick]
  );

  const startScenario = useCallback(
    (
      machineId: string,
      scenario: SimulationScenarioId,
      faultMode?: SensorFaultMode
    ) => {
      clearPendingScenarioTimeout();
      const nowIso = new Date().toISOString();

      setMachines((prev) =>
        prev.map((m) => {
          if (m.id !== machineId) return m;
          const lastReading = m.readings[m.readings.length - 1];
          const needsCleanAnchor =
            m.healthStatus !== 'NORMAL' ||
            m.sensorHealth !== 'Connected' ||
            (lastReading && lastReading.machineCondition !== 'NORMAL');

          const anchorReadings: SensorReading[] = needsCleanAnchor
            ? [
                {
                  timestamp: nowIso,
                  vibrationMmS: m.fingerprint.vibrationMeanMmS,
                  temperatureC: m.fingerprint.temperatureMeanC,
                  acousticDb: m.fingerprint.acousticMeanDb,
                  currentAmps: m.fingerprint.currentMeanAmps,
                  peakAccelG: Number(
                    (m.fingerprint.vibrationMeanMmS * 0.14 + 0.08).toFixed(2)
                  ),
                  sensorHealth: 'Connected',
                  machineCondition: 'NORMAL',
                  rawNote: 'Cleared previous scenario state',
                  isSimulated: true,
                },
              ]
            : [];

          return {
            ...m,
            activeScenario: scenario,
            scenarioRunning: true,
            scenarioPaused: false,
            scenarioStep: 0,
            healthStatus: 'NORMAL',
            sensorFaultMode: faultMode ?? m.sensorFaultMode,
            sensorHealth: 'Connected',
            sensorIssueDetail: null,
            readings: [
              ...m.readings.slice(-(29 - anchorReadings.length)),
              ...anchorReadings,
            ],
          };
        })
      );

      setAlerts((prev) =>
        prev.map((a) =>
          a.machineId === machineId && a.status === 'Active'
            ? { ...a, status: 'Resolved' }
            : a
        )
      );

      pendingScenarioTimeoutRef.current = window.setTimeout(() => {
        pendingScenarioTimeoutRef.current = null;
        processMachineTick(machineId, true);
      }, 30);

      const labelMap: Record<SimulationScenarioId, string> = {
        healthy: 'Healthy Operation',
        gradual_vibration: 'Gradual Vibration Increase',
        overheating: 'Overheating',
        combined_anomaly: 'Combined Anomaly',
        temporary_fluctuation: 'Temporary Fluctuation',
        sensor_disconnection: 'Sensor Disconnection',
      };
      showFeedback(
        'info',
        `Started "${labelMap[scenario]}" scenario on ${machineId}. Readings are updating dynamically.`
      );
    },
    [clearPendingScenarioTimeout, processMachineTick, showFeedback]
  );

  const pauseScenario = useCallback(
    (machineId: string) => {
      clearPendingScenarioTimeout();
      setMachines((prev) =>
        prev.map((m) =>
          m.id === machineId
            ? { ...m, scenarioRunning: false, scenarioPaused: true }
            : m
        )
      );
      showFeedback('info', `Paused active scenario on ${machineId}. Click Resume to continue.`);
    },
    [clearPendingScenarioTimeout, showFeedback]
  );

  const resumeScenario = useCallback(
    (machineId: string) => {
      clearPendingScenarioTimeout();
      setMachines((prev) =>
        prev.map((m) =>
          m.id === machineId
            ? { ...m, scenarioRunning: true, scenarioPaused: false }
            : m
        )
      );
      pendingScenarioTimeoutRef.current = window.setTimeout(() => {
        pendingScenarioTimeoutRef.current = null;
        processMachineTick(machineId, true);
      }, 30);
      showFeedback('success', `Resumed scenario progression on ${machineId}.`);
    },
    [clearPendingScenarioTimeout, processMachineTick, showFeedback]
  );

  const stopScenario = useCallback(
    (machineId: string) => {
      clearPendingScenarioTimeout();
      setMachines((prev) =>
        prev.map((m) =>
          m.id === machineId
            ? { ...m, scenarioRunning: false, scenarioPaused: false }
            : m
        )
      );
      showFeedback('info', `Stopped active scenario progression for ${machineId}.`);
    },
    [clearPendingScenarioTimeout, showFeedback]
  );

  const restartScenario = useCallback(
    (machineId: string) => {
      const target = machines.find((m) => m.id === machineId);
      if (!target) return;
      startScenario(machineId, target.activeScenario, target.sensorFaultMode);
    },
    [machines, startScenario]
  );

  const resetMachineScenario = useCallback(
    (machineId: string) => {
      clearPendingScenarioTimeout();
      const nowIso = new Date().toISOString();
      setMachines((prev) =>
        prev.map((m) => {
          if (m.id !== machineId) return m;
          const vib = m.fingerprint.vibrationMeanMmS;
          const temp = m.fingerprint.temperatureMeanC;
          const acoustic = m.fingerprint.acousticMeanDb;
          const current = m.fingerprint.currentMeanAmps;
          const cleanReading: SensorReading = {
            timestamp: nowIso,
            vibrationMmS: vib,
            temperatureC: temp,
            acousticDb: acoustic,
            currentAmps: current,
            peakAccelG: Number((vib * 0.14 + 0.08).toFixed(2)),
            sensorHealth: 'Connected',
            machineCondition: 'NORMAL',
            rawNote: 'Scenario reset to nominal baseline',
            isSimulated: true,
          };
          return {
            ...m,
            activeScenario: 'healthy',
            scenarioRunning: false,
            scenarioPaused: false,
            scenarioStep: 0,
            healthStatus: 'NORMAL',
            sensorHealth: 'Connected',
            sensorIssueDetail: null,
            statusSummary:
              'Scenario reset. Simulated readings restored inside demonstration baseline envelope.',
            latestVibrationMmS: vib,
            latestTemperatureC: temp,
            latestAcousticDb: acoustic,
            latestCurrentAmps: current,
            latestPeakAccelG: cleanReading.peakAccelG,
            lastUpdated: nowIso,
            readings: [...m.readings.slice(-19), cleanReading],
          };
        })
      );

      setAlerts((prev) =>
        prev.map((a) =>
          a.machineId === machineId && a.status === 'Active'
            ? { ...a, status: 'Resolved' }
            : a
        )
      );

      showFeedback(
        'success',
        `Reset ${machineId} to NORMAL baseline and resolved its active alerts.`
      );
    },
    [clearPendingScenarioTimeout, showFeedback]
  );

  const setMachineFaultMode = useCallback(
    (machineId: string, mode: SensorFaultMode) => {
      setMachines((prev) =>
        prev.map((m) =>
          m.id === machineId ? { ...m, sensorFaultMode: mode } : m
        )
      );
    },
    []
  );

  const acknowledgeAlert = useCallback(
    (alertId: string) => {
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === alertId && a.status === 'Active'
            ? { ...a, status: 'Acknowledged' as AlertStatus }
            : a
        )
      );
      showFeedback('info', `Alert ${alertId} marked as Acknowledged.`);
    },
    [showFeedback]
  );

  const resolveAlert = useCallback(
    (alertId: string) => {
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === alertId ? { ...a, status: 'Resolved' as AlertStatus } : a
        )
      );
      showFeedback(
        'success',
        `Alert ${alertId} marked as Resolved (retained in history log).`
      );
    },
    [showFeedback]
  );

  const clearAlertHistory = useCallback(() => {
    setAlerts((prev) => prev.filter((a) => a.status === 'Active'));
    showFeedback(
      'info',
      'Historical resolved and acknowledged alert events cleared.'
    );
  }, [showFeedback]);

  // Baseline Workflow Step 1: Confirm Machine Healthy
  const confirmMachineHealthy = useCallback(
    (machineId: string): { ok: boolean; message: string } => {
      const target = machines.find((m) => m.id === machineId);
      if (!target) {
        return { ok: false, message: 'Machine not found.' };
      }
      if (target.sensorHealth !== 'Connected') {
        const msg = `Cannot confirm ${machineId} healthy while sensor status is SENSOR ISSUE.`;
        showFeedback('warning', msg);
        return { ok: false, message: msg };
      }
      if (target.healthStatus !== 'NORMAL') {
        const msg = `Cannot confirm ${machineId} healthy while condition is ${target.healthStatus}. Restore normal operation first.`;
        showFeedback('warning', msg);
        return { ok: false, message: msg };
      }
      const hasActive = alerts.some(
        (a) => a.machineId === machineId && a.status === 'Active'
      );
      if (hasActive) {
        const msg = `Resolve active alerts on ${machineId} before confirming healthy condition.`;
        showFeedback('warning', msg);
        return { ok: false, message: msg };
      }

      const nowIso = new Date().toISOString();
      setMachines((prev) =>
        prev.map((m) =>
          m.id === machineId
            ? {
                ...m,
                fingerprint: {
                  ...m.fingerprint,
                  healthyConfirmed: true,
                  confirmedBy: settings.operatorName,
                  lastUpdated: nowIso,
                },
              }
            : m
        )
      );
      const msg = `Operator confirmed ${machineId} is operating in a healthy state. You may now start learning.`;
      showFeedback('success', msg);
      return { ok: true, message: msg };
    },
    [alerts, machines, settings.operatorName, showFeedback]
  );

  // Baseline Workflow Step 2: Start Learning
  const startBaselineLearning = useCallback(
    (machineId: string): { ok: boolean; message: string } => {
      const target = machines.find((m) => m.id === machineId);
      if (!target) {
        return { ok: false, message: 'Machine not found.' };
      }
      if (!target.fingerprint.healthyConfirmed) {
        const msg = 'Confirm Machine Healthy first before starting baseline learning.';
        showFeedback('warning', msg);
        return { ok: false, message: msg };
      }
      if (
        target.sensorHealth !== 'Connected' ||
        target.healthStatus !== 'NORMAL'
      ) {
        const msg =
          'Baseline learning blocked: machine must be NORMAL with a Connected sensor.';
        showFeedback('warning', msg);
        return { ok: false, message: msg };
      }

      const nowIso = new Date().toISOString();
      setMachines((prev) =>
        prev.map((m) =>
          m.id === machineId
            ? {
                ...m,
                fingerprint: {
                  ...m.fingerprint,
                  status: 'Learning in Progress',
                  samplesCollected: 0,
                  learningProgress: 0,
                  learningBufferVib: [],
                  learningBufferTemp: [],
                  learningBufferAcoustic: [],
                  learningBufferCurrent: [],
                  lastUpdated: nowIso,
                },
              }
            : m
        )
      );
      const msg = `Baseline learning started for ${machineId}. Capture 12 healthy simulated samples or run Live Monitoring.`;
      showFeedback('info', msg);
      return { ok: true, message: msg };
    },
    [machines, showFeedback]
  );

  const captureLearningSample = useCallback(
    (machineId: string) => {
      processMachineTick(machineId, false);
    },
    [processMachineTick]
  );

  // Baseline Workflow Step 3: Explicit Operator Complete Baseline
  const completeBaseline = useCallback(
    (machineId: string): { ok: boolean; message: string } => {
      const target = machines.find((m) => m.id === machineId);
      if (!target) return { ok: false, message: 'Machine not found.' };
      if (!target.fingerprint.healthyConfirmed) {
        const msg = 'Healthy confirmation is required before completing a baseline.';
        showFeedback('warning', msg);
        return { ok: false, message: msg };
      }
      if (target.sensorHealth !== 'Connected' || target.healthStatus !== 'NORMAL') {
        const msg =
          'Cannot complete baseline while machine has an active anomaly or SENSOR ISSUE.';
        showFeedback('warning', msg);
        return { ok: false, message: msg };
      }
      if (target.fingerprint.samplesCollected < target.fingerprint.samplesRequired) {
        const msg = `Collect all ${target.fingerprint.samplesRequired} learning samples before completing the baseline.`;
        showFeedback('warning', msg);
        return { ok: false, message: msg };
      }

      const nowIso = new Date().toISOString();
      setMachines((prev) =>
        prev.map((m) =>
          m.id === machineId
            ? {
                ...m,
                fingerprint: {
                  ...m.fingerprint,
                  status: 'Ready for Monitoring',
                  confirmedBy: settings.operatorName,
                  lastUpdated: nowIso,
                },
              }
            : m
        )
      );
      const msg = `Baseline for ${machineId} approved and marked Ready for Monitoring.`;
      showFeedback('success', msg);
      return { ok: true, message: msg };
    },
    [machines, settings.operatorName, showFeedback]
  );

  const resetBaseline = useCallback(
    (machineId: string) => {
      const nowIso = new Date().toISOString();
      setMachines((prev) =>
        prev.map((m) =>
          m.id === machineId
            ? {
                ...m,
                fingerprint: {
                  ...m.fingerprint,
                  status: 'Not Established',
                  healthyConfirmed: false,
                  confirmedBy: 'Pending operator confirmation',
                  learningProgress: 0,
                  samplesCollected: 0,
                  learningBufferVib: [],
                  learningBufferTemp: [],
                  learningBufferAcoustic: [],
                  learningBufferCurrent: [],
                  lastUpdated: nowIso,
                },
              }
            : m
        )
      );
      showFeedback(
        'info',
        `Baseline reset for ${machineId}. Status is now Not Established.`
      );
    },
    [showFeedback]
  );

  // Reset Demo: stops active simulations/monitoring, restores original normal baseline & NORMAL status,
  // clears active alerts (resolving them) while preserving historical alert log unless user clears history.
  const resetDemoData = useCallback(() => {
    clearPendingScenarioTimeout();
    setIsMonitoring(false);
    setMachines(createResetMachines());
    setAlerts((prev) =>
      prev.map((a) =>
        a.status === 'Active' ? { ...a, status: 'Resolved' as AlertStatus } : a
      )
    );
    setSettings(DEFAULT_SETTINGS);
    showFeedback(
      'success',
      'Demo reset: all machines restored to NORMAL baseline, active alerts resolved, and historical log preserved.'
    );
  }, [clearPendingScenarioTimeout, showFeedback]);

  const healthMetricsByMachine = useMemo(() => {
    const map: Record<string, MachineHealthMetrics> = {};
    for (const m of machines) {
      map[m.id] = computeMachineHealthMetrics(m, settings);
    }
    return map;
  }, [machines, settings]);

  const summaryCounts = useMemo<SummaryCounts>(() => {
    const totalMachines = machines.length;
    const healthy = machines.filter(
      (m) => m.healthStatus === 'NORMAL' && m.sensorHealth === 'Connected'
    ).length;
    const warning = machines.filter(
      (m) => m.healthStatus === 'WARNING' && m.sensorHealth === 'Connected'
    ).length;
    const critical = machines.filter((m) => m.healthStatus === 'CRITICAL').length;
    const sensorIssue = machines.filter(
      (m) => m.sensorHealth === 'SENSOR ISSUE'
    ).length;
    const underObservation = warning + sensorIssue;
    const activeAlerts = alerts.filter((a) => a.status === 'Active').length;

    const scoreSum = machines.reduce((acc, m) => {
      const score = healthMetricsByMachine[m.id]?.healthScore;
      return acc + (score !== null && score !== undefined ? score : 35);
    }, 0);
    const fleetHealthScore =
      totalMachines > 0 ? Math.round(scoreSum / totalMachines) : 0;

    return {
      totalMachines,
      healthy,
      warning,
      critical,
      sensorIssue,
      underObservation,
      fleetHealthScore,
      activeAlerts,
    };
  }, [machines, alerts, healthMetricsByMachine]);

  const value: SanketContextValue = {
    activePage,
    setActivePage,
    selectedMachineId,
    setSelectedMachineId,
    detailMachineId,
    openMachineDetails,
    closeMachineDetails,
    machines,
    alerts,
    settings,
    updateSettings,
    summaryCounts,
    healthMetricsByMachine,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    sampleIntervalMs,
    setSampleIntervalMs,
    stepSimulatedSample,
    startScenario,
    pauseScenario,
    resumeScenario,
    stopScenario,
    restartScenario,
    resetMachineScenario,
    setMachineFaultMode,
    acknowledgeAlert,
    resolveAlert,
    clearAlertHistory,
    confirmMachineHealthy,
    startBaselineLearning,
    captureLearningSample,
    completeBaseline,
    resetBaseline,
    resetDemoData,
    actionFeedback,
    clearActionFeedback,
  };

  return (
    <SanketContext.Provider value={value}>{children}</SanketContext.Provider>
  );
};

export function useSanket(): SanketContextValue {
  const ctx = useContext(SanketContext);
  if (!ctx) {
    throw new Error('useSanket must be used within a SanketProvider');
  }
  return ctx;
}

export type NavigationPage =
  | 'overview'
  | 'machines'
  | 'fingerprint'
  | 'live'
  | 'alerts'
  | 'simulation'
  | 'integration'
  | 'settings';

export type MachineType = 'pump' | 'motor' | 'fan';

export type HealthStatus = 'NORMAL' | 'WARNING' | 'CRITICAL';

export type SensorHealth = 'Connected' | 'SENSOR ISSUE';

export type BaselineStatus =
  | 'Not Established'
  | 'Learning in Progress'
  | 'Ready for Monitoring'
  | 'Requires Verification';

export type AlertSeverity = 'Info' | 'Warning' | 'Critical';

export type AlertStatus = 'Active' | 'Acknowledged' | 'Resolved';

export type SimulationScenarioId =
  | 'healthy'
  | 'gradual_vibration'
  | 'overheating'
  | 'combined_anomaly'
  | 'temporary_fluctuation'
  | 'sensor_disconnection';

export type SensorFaultMode = 'missing' | 'frozen' | 'invalid';

export type SensitivityLevel = 'Low' | 'Standard' | 'High';

export interface SensorReading {
  timestamp: string;
  vibrationMmS: number | null;
  temperatureC: number | null;
  acousticDb: number | null;
  currentAmps: number | null;
  peakAccelG: number | null;
  sensorHealth: SensorHealth;
  machineCondition: HealthStatus;
  rawNote?: string;
  isSimulated: true;
}

export interface HealthFingerprint {
  status: BaselineStatus;
  healthyConfirmed: boolean;
  confirmedBy: string;
  isDemonstrationBaseline: boolean;
  vibrationMinMmS: number;
  vibrationMaxMmS: number;
  vibrationMeanMmS: number;
  temperatureMinC: number;
  temperatureMaxC: number;
  temperatureMeanC: number;
  acousticMinDb: number;
  acousticMaxDb: number;
  acousticMeanDb: number;
  currentMinAmps: number;
  currentMaxAmps: number;
  currentMeanAmps: number;
  learningProgress: number; // 0 to 100
  samplesCollected: number;
  samplesRequired: number;
  learningBufferVib: number[];
  learningBufferTemp: number[];
  learningBufferAcoustic: number[];
  learningBufferCurrent: number[];
  lastUpdated: string;
}

export interface Machine {
  id: string;
  name: string;
  category: string;
  type: MachineType;
  location: string;
  ratedRpm: number;
  powerRating: string;
  healthStatus: HealthStatus;
  sensorHealth: SensorHealth;
  sensorIssueDetail: string | null;
  statusSummary: string;
  activeScenario: SimulationScenarioId;
  scenarioRunning: boolean;
  scenarioPaused: boolean;
  scenarioStep: number;
  sensorFaultMode: SensorFaultMode;
  latestVibrationMmS: number | null;
  latestTemperatureC: number | null;
  latestAcousticDb: number | null;
  latestCurrentAmps: number | null;
  latestPeakAccelG: number | null;
  lastUpdated: string;
  fingerprint: HealthFingerprint;
  readings: SensorReading[];
}

export interface AlertEvent {
  id: string;
  timestamp: string;
  machineId: string;
  machineName: string;
  alertType: string;
  severity: AlertSeverity;
  triggeringParameter: string;
  observedReading: string;
  thresholdReference: string;
  baselineComparison: string;
  whatChanged: string;
  persistenceSummary: string;
  suggestedInspection: string;
  reason: string;
  status: AlertStatus;
  occurrenceCount?: number;
  isSimulated: true;
}

export interface AppSettings {
  operatorName: string;
  operatorRole: string;
  workspaceLabel: string;
  inAppNotifications: boolean;
  warningEscalation: boolean;
  correlateVibAndTemp: boolean;
  emailDigestPreview: boolean;
  sensitivity: SensitivityLevel;
}

export interface ScenarioDefinition {
  id: SimulationScenarioId;
  code: string;
  title: string;
  description: string;
  expectedOutcome: string;
  effectLabel: string;
}

export type ParameterConditionLevel =
  | 'Normal'
  | 'Elevated'
  | 'Critical'
  | 'No Signal';

export interface MachineHealthMetrics {
  healthScore: number | null; // 0-100 illustrative score, null when sensor disconnected
  deviationPercent: number; // 0-100 for gauge alignment
  riskClassification:
    | 'Low Risk (Nominal)'
    | 'Moderate Risk (Warning)'
    | 'High Risk (Critical)'
    | 'Unverified (Sensor Disconnected)';
  filteredVibrationMmS: number | null;
  filteredTemperatureC: number | null;
  filteredAcousticDb: number | null;
  filteredCurrentAmps: number | null;
  vibrationStatus: ParameterConditionLevel;
  temperatureStatus: ParameterConditionLevel;
  acousticStatus: ParameterConditionLevel;
  currentStatus: ParameterConditionLevel;
  vibrationDeviationPct: number | null;
  temperatureDeltaC: number | null;
  acousticDeltaDb: number | null;
  currentDeviationPct: number | null;
  abnormalParametersExplanation: string;
}

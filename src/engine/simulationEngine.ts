import { Machine } from '../types/sanket';
import { SimulatedSampleInput } from './anomalyEngine';

export function generateNextScenarioValues(
  machine: Machine,
  nextStep: number
): SimulatedSampleInput {
  const fp = machine.fingerprint;
  const meanVib = fp.vibrationMeanMmS;
  const meanTemp = fp.temperatureMeanC;
  const meanAcoustic = fp.acousticMeanDb;
  const meanCurrent = fp.currentMeanAmps;

  const vibSpan = Math.max(0.4, fp.vibrationMaxMmS - fp.vibrationMinMmS);
  const tempSpan = Math.max(3.0, fp.temperatureMaxC - fp.temperatureMinC);

  switch (machine.activeScenario) {
    case 'healthy': {
      const vib = Number(
        (
          meanVib +
          Math.sin(nextStep * 0.8) * (vibSpan * 0.16) +
          (Math.random() - 0.5) * 0.08
        ).toFixed(2)
      );
      const temp = Number(
        (
          meanTemp +
          Math.cos(nextStep * 0.5) * (tempSpan * 0.14) +
          (Math.random() - 0.5) * 0.3
        ).toFixed(1)
      );
      const acoustic = Number(
        (meanAcoustic + Math.sin(nextStep * 0.6) * 1.1 + (Math.random() - 0.5) * 0.6).toFixed(1)
      );
      const current = Number(
        (meanCurrent + Math.cos(nextStep * 0.4) * 0.25 + (Math.random() - 0.5) * 0.12).toFixed(1)
      );
      return { vib, temp, acoustic, current };
    }

    case 'gradual_vibration': {
      // Progressive climb: step 1 enters near ceiling, steps 2-4 enter WARNING, steps 5+ reach CRITICAL
      const ramp = Math.min(2.6, nextStep * 0.36);
      const vib = Number(
        (fp.vibrationMaxMmS - 0.1 + ramp + (Math.random() - 0.5) * 0.05).toFixed(2)
      );
      const temp = Number((meanTemp + Math.min(2.6, nextStep * 0.25)).toFixed(1));
      const acoustic = Number((meanAcoustic + Math.min(14.0, nextStep * 1.6)).toFixed(1));
      const current = Number((meanCurrent + Math.min(1.8, nextStep * 0.18)).toFixed(1));
      return { vib, temp, acoustic, current };
    }

    case 'overheating': {
      const ramp = Math.min(18.5, nextStep * 1.95);
      const vib = Number((meanVib + 0.16 + (Math.random() - 0.5) * 0.08).toFixed(2));
      const temp = Number(
        (fp.temperatureMaxC - 0.5 + ramp + (Math.random() - 0.5) * 0.3).toFixed(1)
      );
      const acoustic = Number((meanAcoustic + Math.min(3.5, nextStep * 0.35)).toFixed(1));
      const current = Number((meanCurrent + Math.min(3.2, nextStep * 0.42)).toFixed(1));
      return { vib, temp, acoustic, current };
    }

    case 'combined_anomaly': {
      const vibRamp = Math.min(2.6, 0.38 + nextStep * 0.34);
      const tempRamp = Math.min(16.5, 2.1 + nextStep * 2.1);
      const vib = Number(
        (fp.vibrationMaxMmS + vibRamp + (Math.random() - 0.5) * 0.08).toFixed(2)
      );
      const temp = Number(
        (fp.temperatureMaxC + tempRamp + (Math.random() - 0.5) * 0.3).toFixed(1)
      );
      const acoustic = Number((fp.acousticMaxDb + Math.min(16.0, 2.5 + nextStep * 1.9)).toFixed(1));
      const current = Number((fp.currentMaxAmps + Math.min(4.2, 0.8 + nextStep * 0.5)).toFixed(1));
      return { vib, temp, acoustic, current };
    }

    case 'temporary_fluctuation': {
      // Single brief spike at step 2 (then returns immediately to nominal at step 3+)
      if (nextStep === 2) {
        return {
          vib: Number((fp.vibrationMaxMmS + vibSpan * 0.85).toFixed(2)),
          temp: Number((meanTemp + 1.9).toFixed(1)),
          acoustic: Number((fp.acousticMaxDb + 4.8).toFixed(1)),
          current: Number((meanCurrent + 0.9).toFixed(1)),
          note: 'Simulated single transient spike',
        };
      }
      return {
        vib: Number((meanVib + Math.sin(nextStep) * 0.08).toFixed(2)),
        temp: Number((meanTemp + Math.cos(nextStep) * 0.3).toFixed(1)),
        acoustic: Number((meanAcoustic + Math.sin(nextStep) * 0.6).toFixed(1)),
        current: Number((meanCurrent + Math.cos(nextStep) * 0.15).toFixed(1)),
      };
    }

    case 'sensor_disconnection': {
      if (machine.sensorFaultMode === 'missing') {
        return {
          vib: null,
          temp: null,
          acoustic: null,
          current: null,
          note: 'Missing packet simulated',
        };
      }
      if (machine.sensorFaultMode === 'invalid') {
        return {
          vib: -9.99,
          temp: 999.9,
          acoustic: -40,
          current: 999,
          note: 'Invalid out-of-range value simulated',
        };
      }
      // Frozen mode: repeat exact constant value
      const frozenVib = machine.latestVibrationMmS ?? meanVib;
      const frozenTemp = machine.latestTemperatureC ?? meanTemp;
      const frozenAcoustic = machine.latestAcousticDb ?? meanAcoustic;
      const frozenCurrent = machine.latestCurrentAmps ?? meanCurrent;
      return {
        vib: frozenVib,
        temp: frozenTemp,
        acoustic: frozenAcoustic,
        current: frozenCurrent,
        note: 'Frozen constant sample simulated',
      };
    }
  }
}

import { GymSettings } from '@/types';

export interface AddOnDefinition {
  key: string;
  name: string;
  defaultFee: number;
  exemptForDailyPass: boolean;
}

export const ADD_ONS: AddOnDefinition[] = [
  { key: 'parq_purchased', name: 'PAR-Q Purchased', defaultFee: 3000, exemptForDailyPass: true },
  { key: 'trainer_package', name: 'Personal Trainer Package', defaultFee: 3000, exemptForDailyPass: false },
];

export function getBaseMembershipFee(
  gender: 'Gents' | 'Ladies',
  duration: string,
  trainingType: 'Weight Training Only' | 'Weight Training + Cardio' | 'Weight Training + Strength Training',
  settings?: GymSettings
): number {
  const dur = duration.trim();
  if (dur === 'Daily Pass') {
    return 50;
  }
  
  // Normalize durations to standard categories
  let normalizedDuration = dur;
  if (dur === '30 Days' || dur === '30' || dur.toLowerCase() === '30 days') normalizedDuration = '1 Month';
  else if (dur === '90 Days' || dur === '90' || dur.toLowerCase() === '90 days') normalizedDuration = '3 Months';
  else if (dur === '180 Days' || dur === '180' || dur.toLowerCase() === '180 days') normalizedDuration = '6 Months';
  
  if (dur === '365 Days' || dur === '365' || dur.toLowerCase() === '365 days' || dur.toLowerCase().includes('year') || dur.toLowerCase() === '1 year') {
    return settings?.plan_annual ? Number(settings.plan_annual) : 14000;
  }

  // Handle custom days pro-rata
  const match = dur.match(/\d+/);
  if (match && normalizedDuration !== '1 Month' && normalizedDuration !== '3 Months' && normalizedDuration !== '6 Months') {
    const days = parseInt(match[0], 10);
    // Avoid infinite recursion by calling with static '1 Month'
    const monthlyRate = getBaseMembershipFee(gender, '1 Month', trainingType, settings);
    return Math.round((monthlyRate / 30) * days);
  }

  if (gender === 'Ladies') {
    if (normalizedDuration === '1 Month') {
      if (trainingType === 'Weight Training Only') {
        return settings?.plan_ladies_wt_1m ? Number(settings.plan_ladies_wt_1m) : 1000;
      } else {
        return settings?.plan_ladies_ws_1m ? Number(settings.plan_ladies_ws_1m) : 1300;
      }
    } else if (normalizedDuration === '3 Months') {
      if (trainingType === 'Weight Training Only') {
        return settings?.plan_ladies_wt_3m ? Number(settings.plan_ladies_wt_3m) : 2750;
      } else {
        return settings?.plan_ladies_ws_3m ? Number(settings.plan_ladies_ws_3m) : 3600;
      }
    } else if (normalizedDuration === '6 Months') {
      if (trainingType === 'Weight Training Only') {
        return settings?.plan_ladies_wt_6m ? Number(settings.plan_ladies_wt_6m) : 5800;
      } else {
        return settings?.plan_ladies_ws_6m ? Number(settings.plan_ladies_ws_6m) : 7300;
      }
    }
  } else { // Gents
    if (normalizedDuration === '1 Month') {
      if (trainingType === 'Weight Training Only') {
        return settings?.plan_gents_wt_1m ? Number(settings.plan_gents_wt_1m) : 1000;
      } else {
        return settings?.plan_gents_wc_1m ? Number(settings.plan_gents_wc_1m) : 1300;
      }
    } else if (normalizedDuration === '3 Months') {
      if (trainingType === 'Weight Training Only') {
        return settings?.plan_gents_wt_3m ? Number(settings.plan_gents_wt_3m) : 2850;
      } else {
        return settings?.plan_gents_wc_3m ? Number(settings.plan_gents_wc_3m) : 3750;
      }
    } else if (normalizedDuration === '6 Months') {
      if (trainingType === 'Weight Training Only') {
        return settings?.plan_gents_wt_6m ? Number(settings.plan_gents_wt_6m) : 5750;
      } else {
        return settings?.plan_gents_wc_6m ? Number(settings.plan_gents_wc_6m) : 7500;
      }
    }
  }
  return 0;
}

export function calculatePackagePrice(inputs: {
  gender: 'Gents' | 'Ladies';
  duration: string;
  trainingType: 'Weight Training Only' | 'Weight Training + Cardio' | 'Weight Training + Strength Training';
  admissionFee: number;
  addOnSelections: Record<string, boolean>;
  settings?: GymSettings;
}) {
  const isDailyPass = inputs.duration === 'Daily Pass';
  const membershipFee = getBaseMembershipFee(inputs.gender, inputs.duration, inputs.trainingType, inputs.settings);
  const admissionFee = Number(inputs.admissionFee) || 0;

  const addOnFees: Record<string, number> = {};
  let totalAddOnFees = 0;

  ADD_ONS.forEach((addOn) => {
    const isSelected = inputs.addOnSelections[addOn.key] || false;
    const isExempt = addOn.exemptForDailyPass && isDailyPass;
    const fee = (isSelected && !isExempt) ? addOn.defaultFee : 0;
    addOnFees[addOn.key] = fee;
    totalAddOnFees += fee;
  });

  const total = membershipFee + admissionFee + totalAddOnFees;

  return {
    membershipFee,
    admissionFee,
    addOnFees,
    total,
  };
}

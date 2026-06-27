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
  duration: 'Daily Pass' | '1 Month' | '3 Months' | '6 Months',
  trainingType: 'Weight Training Only' | 'Weight Training + Cardio' | 'Weight Training + Strength Training'
): number {
  if (duration === 'Daily Pass') {
    return 50;
  }
  
  if (gender === 'Ladies') {
    if (duration === '1 Month') {
      return trainingType === 'Weight Training Only' ? 1000 : 1300;
    } else if (duration === '3 Months') {
      return trainingType === 'Weight Training Only' ? 2750 : 3600;
    } else if (duration === '6 Months') {
      return trainingType === 'Weight Training Only' ? 5800 : 7300;
    }
  } else { // Gents
    if (duration === '1 Month') {
      return trainingType === 'Weight Training Only' ? 1000 : 1300;
    } else if (duration === '3 Months') {
      return trainingType === 'Weight Training Only' ? 2850 : 3750;
    } else if (duration === '6 Months') {
      return trainingType === 'Weight Training Only' ? 5750 : 7500;
    }
  }
  return 0;
}

export function calculatePackagePrice(inputs: {
  gender: 'Gents' | 'Ladies';
  duration: 'Daily Pass' | '1 Month' | '3 Months' | '6 Months';
  trainingType: 'Weight Training Only' | 'Weight Training + Cardio' | 'Weight Training + Strength Training';
  admissionFee: number;
  addOnSelections: Record<string, boolean>;
}) {
  const isDailyPass = inputs.duration === 'Daily Pass';
  const membershipFee = getBaseMembershipFee(inputs.gender, inputs.duration, inputs.trainingType);
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

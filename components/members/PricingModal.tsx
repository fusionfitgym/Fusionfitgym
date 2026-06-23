'use client';

import { useState } from 'react';
import { 
  X, 
  Dumbbell, 
  Check, 
  Flame, 
  Activity, 
  Sparkles, 
  ShieldCheck 
} from 'lucide-react';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Package {
  name: string;
  price: number;
  duration: string;
  features: string[];
  popular?: boolean;
}

export function PricingModal({ isOpen, onClose }: PricingModalProps) {
  const [activeTab, setActiveTab] = useState<'mens' | 'ladies'>('mens');

  if (!isOpen) return null;

  const mensPackages: Package[] = [
    {
      name: "1 Month Weight Training",
      price: 1000,
      duration: "1 Month",
      features: [
        "Access to Weight Training Section",
        "Basic Fitness Assessment",
        "General Trainer Guidance",
      ]
    },
    {
      name: "1 Month Weight Training + Cardio",
      price: 1300,
      duration: "1 Month",
      features: [
        "Access to Weight & Cardio Sections",
        "Basic Fitness Assessment",
        "General Trainer Guidance",
      ]
    },
    {
      name: "3 Months Weight Training",
      price: 2850,
      duration: "3 Months",
      features: [
        "Access to Weight Training Section",
        "Detailed Body Composition Analysis",
        "Customized General Workout Plan",
      ]
    },
    {
      name: "3 Months Weight Training + Cardio",
      price: 3750,
      duration: "3 Months",
      popular: true,
      features: [
        "Access to Weight & Cardio Sections",
        "Detailed Body Composition Analysis",
        "Customized General Workout Plan",
        "Best Value Package",
      ]
    },
    {
      name: "6 Months Weight Training",
      price: 5750,
      duration: "6 Months",
      features: [
        "Access to Weight Training Section",
        "Bi-Monthly Progress Assessments",
        "Customized General Workout Plan",
      ]
    },
    {
      name: "6 Months Weight Training + Cardio",
      price: 7500,
      duration: "6 Months",
      features: [
        "Access to Weight & Cardio Sections",
        "Bi-Monthly Progress Assessments",
        "Customized General Workout Plan",
      ]
    }
  ];

  const ladiesPackages: Package[] = [
    {
      name: "1 Month Weight Training",
      price: 1000,
      duration: "1 Month",
      features: [
        "Access to Weight Training Section",
        "Basic Fitness Assessment",
        "General Trainer Guidance",
      ]
    },
    {
      name: "1 Month Weight Training + Strength",
      price: 1300,
      duration: "1 Month",
      features: [
        "Access to Weight & Strength Sections",
        "Basic Fitness Assessment",
        "General Trainer Guidance",
      ]
    },
    {
      name: "3 Months Weight Training",
      price: 2750,
      duration: "3 Months",
      features: [
        "Access to Weight Training Section",
        "Detailed Body Composition Analysis",
        "Customized General Workout Plan",
      ]
    },
    {
      name: "3 Months Weight Training + Strength",
      price: 3600,
      duration: "3 Months",
      popular: true,
      features: [
        "Access to Weight & Strength Sections",
        "Detailed Body Composition Analysis",
        "Customized General Workout Plan",
        "Best Value Package",
      ]
    },
    {
      name: "6 Months Weight Training",
      price: 5800,
      duration: "6 Months",
      features: [
        "Access to Weight Training Section",
        "Bi-Monthly Progress Assessments",
        "Customized General Workout Plan",
      ]
    },
    {
      name: "6 Months Weight Training + Strength",
      price: 7300,
      duration: "6 Months",
      features: [
        "Access to Weight & Strength Sections",
        "Bi-Monthly Progress Assessments",
        "Customized General Workout Plan",
      ]
    }
  ];

  const currentPackages = activeTab === 'mens' ? mensPackages : ladiesPackages;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div 
        className="bg-[#121620] border border-white/[0.08] w-full max-w-5xl rounded-3xl p-6 sm:p-8 shadow-[0_24px_64px_rgba(0,0,0,0.4)] relative flex flex-col max-h-[90vh] overflow-hidden text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer"
          aria-label="Close pricing guide"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider mb-2">
            <Sparkles className="h-3.5 w-3.5" /> Reference Guide
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Gym Membership Packages &amp; Pricing
          </h3>
          <p className="text-zinc-400 text-xs sm:text-sm mt-1 leading-normal">
            Browse rates for weights, cardio, strength equipment, and monthly packages.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex justify-start mb-6">
          <div className="bg-zinc-950/40 border border-white/[0.04] p-1 rounded-xl flex max-w-xs w-full">
            <button
              onClick={() => setActiveTab('mens')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 ${
                activeTab === 'mens' 
                  ? 'bg-amber-300 text-zinc-950 shadow-sm font-extrabold' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Dumbbell className="h-3.5 w-3.5" />
              Men's
            </button>
            <button
              onClick={() => setActiveTab('ladies')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 ${
                activeTab === 'ladies' 
                  ? 'bg-amber-300 text-zinc-950 shadow-sm font-extrabold' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Activity className="h-3.5 w-3.5" />
              Ladies'
            </button>
          </div>
        </div>

        {/* Pricing Cards Scroll Container */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {currentPackages.map((pkg, index) => {
              const isPopular = pkg.popular;
              return (
                <div 
                  key={`${pkg.name}-${index}`}
                  className={`rounded-2xl bg-zinc-950/30 border p-5 flex flex-col justify-between relative overflow-hidden transition-all ${
                    isPopular 
                      ? 'border-amber-400/60 shadow-[0_4px_20px_rgba(244,196,48,0.05)]' 
                      : 'border-white/[0.04]'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider font-semibold">
                        {pkg.duration}
                      </span>
                      {isPopular && (
                        <span className="inline-flex items-center gap-1 bg-amber-400/10 text-amber-300 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-amber-400/20">
                          <Flame className="h-2.5 w-2.5 fill-amber-300" /> Popular
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-white tracking-tight leading-snug">
                      {pkg.name}
                    </h4>
                    <div className="text-xl font-extrabold text-white mt-3 font-mono">
                      ₹{pkg.price}
                    </div>

                    <div className="border-t border-white/[0.04] my-3" />

                    <ul className="space-y-2">
                      {pkg.features.map((feature, fIndex) => (
                        <li key={fIndex} className="flex items-start gap-2 text-xs">
                          <Check className="h-3 w-3 text-emerald-400 mt-0.5 shrink-0" strokeWidth={3} />
                          <span className="text-zinc-400 leading-normal">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl border border-white/[0.04] bg-zinc-950/20 p-4 flex items-start gap-3.5 text-xs text-zinc-400 leading-relaxed">
            <ShieldCheck className="h-5 w-5 text-amber-400 shrink-0" />
            <span>
              All member registrations should match the billing amounts shown above. When generating new invoices, use these guides for manual input reference.
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end pt-5 mt-6 border-t border-white/[0.06] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-white px-5 text-xs font-bold transition-all cursor-pointer"
          >
            Close Reference
          </button>
        </div>
      </div>
    </div>
  );
}

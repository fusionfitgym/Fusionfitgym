'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Dumbbell, 
  Check, 
  ArrowLeft, 
  Flame, 
  MessageSquare, 
  ShieldCheck, 
  Sparkles, 
  Zap, 
  Activity, 
  Clock 
} from 'lucide-react';
import { getSettings } from '@/lib/actions/settings';
import { GymSettings } from '@/types';
import { formatCurrency } from '@/lib/utils';

interface Package {
  name: string;
  price: number;
  duration: string;
  features: string[];
  popular?: boolean;
}

export default function PricingPage() {
  const [activeTab, setActiveTab] = useState<'mens' | 'ladies'>('mens');
  const [settings, setSettings] = useState<GymSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSettings()
      .then((data) => setSettings(data))
      .catch((err) => {
        console.error('Failed to load settings on pricing page:', err);
      })
      .finally(() => setLoading(false));
  }, []);

  const gymName = settings?.gym_name || 'FusionFit Gym';
  const gymPhone = settings?.gym_phone || '+91 949013275';

  // Clean phone number for WhatsApp link
  const cleanPhone = gymPhone.replace(/[^0-9+]/g, '');

  const getWhatsAppLink = (pkgName: string, category: string) => {
    const text = `Hi ${gymName}, I want to join the ${category} Package: ${pkgName}. Please share details on how to register.`;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  };

  const mensPackages: Package[] = [
    // 1 Month
    {
      name: "1 Month Weight Training",
      price: 1000,
      duration: "1 Month",
      features: [
        "Access to Weight Training Section",
        "Basic Fitness Assessment",
        "General Trainer Guidance",
        "Locker Room & Shower Access",
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
        "Locker Room & Shower Access",
        "Cardio Machine Access",
      ]
    },
    // 3 Months (Popular)
    {
      name: "3 Months Weight Training",
      price: 2850,
      duration: "3 Months",
      features: [
        "Access to Weight Training Section",
        "Detailed Body Composition Analysis",
        "Customized General Workout Plan",
        "Locker Room & Shower Access",
        "Save 5% compared to monthly",
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
        "Locker Room & Shower Access",
        "Priority Cardio Machine Access",
        "Best Value Package",
      ]
    },
    // 6 Months
    {
      name: "6 Months Weight Training",
      price: 5750,
      duration: "6 Months",
      features: [
        "Access to Weight Training Section",
        "Bi-Monthly Progress Assessments",
        "Customized General Workout Plan",
        "Locker Room & Shower Access",
        "Save 5% compared to monthly",
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
        "Locker Room & Shower Access",
        "Priority Cardio Machine Access",
        "Save 4% compared to monthly",
      ]
    }
  ];

  const ladiesPackages: Package[] = [
    // 1 Month
    {
      name: "1 Month Weight Training",
      price: 1000,
      duration: "1 Month",
      features: [
        "Access to Weight Training Section",
        "Basic Fitness Assessment",
        "General Trainer Guidance",
        "Locker Room & Shower Access",
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
        "Locker Room & Shower Access",
        "Strength Equipment Access",
      ]
    },
    // 3 Months (Popular)
    {
      name: "3 Months Weight Training",
      price: 2750,
      duration: "3 Months",
      features: [
        "Access to Weight Training Section",
        "Detailed Body Composition Analysis",
        "Customized General Workout Plan",
        "Locker Room & Shower Access",
        "Save 8% compared to monthly",
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
        "Locker Room & Shower Access",
        "Priority Strength Trainer Guidance",
        "Best Value Package",
      ]
    },
    // 6 Months
    {
      name: "6 Months Weight Training",
      price: 5800,
      duration: "6 Months",
      features: [
        "Access to Weight Training Section",
        "Bi-Monthly Progress Assessments",
        "Customized General Workout Plan",
        "Locker Room & Shower Access",
        "Save 3% compared to monthly",
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
        "Locker Room & Shower Access",
        "Priority Strength Trainer Guidance",
        "Save 6% compared to monthly",
      ]
    }
  ];

  const currentPackages = activeTab === 'mens' ? mensPackages : ladiesPackages;
  const currentCategoryLabel = activeTab === 'mens' ? "Men's" : "Ladies'";

  return (
    <div className="min-h-screen bg-[#0b0d12] text-white flex flex-col relative overflow-hidden font-sans">
      {/* Background radial glow */}
      <div className="absolute top-[-25%] left-[-15%] w-[800px] h-[800px] bg-amber-500/5 rounded-full filter blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[700px] h-[700px] bg-amber-500/5 rounded-full filter blur-[140px] pointer-events-none" />
      <div className="absolute right-[20%] top-[30%] w-[400px] h-[400px] bg-emerald-500/3 rounded-full filter blur-[100px] pointer-events-none" />

      {/* Header / Navigation */}
      <header className="border-b border-white/[0.06] backdrop-blur-md sticky top-0 z-30 bg-[#0b0d12]/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-300 shadow-[0_4px_16px_rgba(244,196,48,0.2)]">
              <Dumbbell className="h-5 w-5 text-zinc-950" strokeWidth={2.4} />
            </div>
            <div>
              <span className="text-lg font-black tracking-tight block leading-none">{gymName}</span>
              <span className="text-[10px] font-bold text-zinc-500 tracking-[0.15em] uppercase">Premium Fitness</span>
            </div>
          </div>
          <Link 
            href="/login" 
            className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
          </Link>
        </div>
      </header>

      {/* Main Pricing Hero Section */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 relative z-10">
        
        {/* Title */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/20 px-4 py-1.5 text-xs font-bold uppercase tracking-wider mb-4 animate-pulse">
            <Sparkles className="h-3.5 w-3.5" /> Special Membership Rates
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-white leading-tight">
            Choose Your <span className="text-amber-300">Fitness Plan</span>
          </h1>
          <p className="text-zinc-400 text-sm sm:text-base mt-4 leading-relaxed">
            Flexible membership programs tailored for weights, cardio, strength development, and personal training support.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex justify-center mb-12">
          <div className="bg-[#121620] border border-white/[0.06] p-1.5 rounded-2xl flex max-w-xs w-full shadow-lg">
            <button
              onClick={() => setActiveTab('mens')}
              className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 ${
                activeTab === 'mens' 
                  ? 'bg-amber-300 text-zinc-950 shadow-md font-extrabold' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Dumbbell className="h-3.5 w-3.5" />
              Men's Packages
            </button>
            <button
              onClick={() => setActiveTab('ladies')}
              className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 ${
                activeTab === 'ladies' 
                  ? 'bg-amber-300 text-zinc-950 shadow-md font-extrabold' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Activity className="h-3.5 w-3.5" />
              Ladies' Packages
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 items-stretch">
          {currentPackages.map((pkg, index) => {
            const isPopular = pkg.popular;
            return (
              <div 
                key={`${pkg.name}-${index}`}
                className={`relative rounded-3xl bg-[#121620] border transition-all duration-300 group flex flex-col justify-between overflow-hidden ${
                  isPopular 
                    ? 'border-amber-400 shadow-[0_8px_30px_rgba(244,196,48,0.1)] scale-102 z-10 md:-translate-y-2' 
                    : 'border-white/[0.06] hover:border-white/[0.15] hover:shadow-[0_8px_30px_rgba(255,255,255,0.02)] hover:-translate-y-1'
                }`}
              >
                {/* Popular highlight gradient overlay */}
                {isPopular && (
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500" />
                )}

                {/* Card Header */}
                <div className="p-6 sm:p-8 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-zinc-500 font-mono text-xs uppercase tracking-wider font-semibold">
                      {pkg.duration} Plan
                    </span>
                    {isPopular && (
                      <span className="inline-flex items-center gap-1 bg-amber-400 text-zinc-950 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm">
                        <Flame className="h-3 w-3 fill-zinc-950" /> Most Popular
                      </span>
                    )}
                  </div>
                  
                  <h3 className="text-xl font-bold text-white mt-4 tracking-tight leading-tight group-hover:text-amber-300 transition-colors">
                    {pkg.name}
                  </h3>

                  <div className="flex items-baseline gap-2 mt-6">
                    <span className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white font-mono">
                      ₹{pkg.price}
                    </span>
                    <span className="text-zinc-500 text-xs font-semibold">
                      / {pkg.duration.toLowerCase()}
                    </span>
                  </div>
                </div>

                {/* Card Divider */}
                <div className="border-t border-white/[0.04] mx-6 sm:mx-8 my-2" />

                {/* Card Features */}
                <div className="p-6 sm:p-8 pt-4 flex-1">
                  <ul className="space-y-3.5">
                    {pkg.features.map((feature, fIndex) => (
                      <li key={fIndex} className="flex items-start gap-3 text-sm">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 mt-0.5">
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                        <span className="text-zinc-300 font-medium leading-normal">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Card CTA */}
                <div className="p-6 sm:p-8 pt-0">
                  <a
                    href={getWhatsAppLink(pkg.name, currentCategoryLabel)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-full h-12 rounded-2xl font-bold text-sm inline-flex items-center justify-center gap-2 group transition-all duration-200 ${
                      isPopular
                        ? 'bg-amber-300 text-zinc-950 shadow-[0_4px_20px_rgba(244,196,48,0.2)] hover:bg-amber-400 active:scale-[0.98]'
                        : 'bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.18] hover:bg-white/[0.08] text-white active:scale-[0.98]'
                    }`}
                  >
                    <MessageSquare className="h-4 w-4" />
                    <span>Join Now</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>

        {/* Dynamic Warning Section */}
        <section className="mt-16 sm:mt-24 p-6 sm:p-8 rounded-3xl border border-white/[0.06] bg-[#121620]/40 backdrop-blur-sm max-w-4xl mx-auto flex flex-col md:flex-row items-start gap-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-400">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h4 className="text-base font-bold text-white tracking-tight">FusionFit Safe Gym Guidelines</h4>
            <p className="text-zinc-400 text-sm mt-1 leading-relaxed">
              All new members are requested to complete a physical readiness questionnaire (PAR-Q form) and a baseline body assessment with our certified trainers upon registration. We ensure standard hygienic practices, lockers, and continuous guidance.
            </p>
            <div className="flex flex-wrap gap-4 sm:gap-6 mt-4 text-xs font-semibold text-zinc-500">
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-amber-300" /> Mon - Sat: 5:00 AM - 10:00 PM
              </span>
              <span className="flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-amber-300" /> Professional Trainers
              </span>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] bg-[#07080a] py-8 text-center text-xs text-zinc-600 relative z-10 mt-auto">
        <p>&copy; {new Date().getFullYear()} {gymName}. All rights reserved.</p>
        <p className="mt-1 text-zinc-700">Powered by REDIX.MEDIA</p>
      </footer>
    </div>
  );
}

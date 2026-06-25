import React from 'react';

export default function DashboardLoading() {
  return (
    <div className="page page-enter select-none animate-pulse">
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/50 pb-5 mb-6">
        <div>
          <div className="h-8 w-48 bg-slate-200 rounded-lg dark:bg-slate-800" />
          <div className="h-4 w-72 bg-slate-100 rounded-md mt-2 dark:bg-slate-900" />
        </div>
        <div className="h-10 w-32 bg-slate-200 rounded-xl dark:bg-slate-800 shrink-0" />
      </div>

      {/* Adaptive Stats Grid skeleton */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="flex min-h-40 flex-col justify-between p-5 sm:p-6 rounded-2xl border border-slate-200/40 bg-white/50 dark:border-slate-800/40 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-2.5">
                <div className="h-3 w-20 bg-slate-200 rounded dark:bg-slate-800" />
                <div className="h-8 w-16 bg-slate-300 rounded-lg dark:bg-slate-700 mt-1" />
              </div>
              <div className="h-11 w-11 shrink-0 rounded-xl bg-amber-100/50 dark:bg-amber-950/20" />
            </div>
            <div className="mt-5">
              <div className="h-3 w-32 bg-slate-100 rounded dark:bg-slate-900" />
            </div>
          </div>
        ))}
      </div>

      {/* SMS Summary Card skeleton */}
      <div className="card mt-6 p-4 sm:p-5 border border-slate-200/40 bg-slate-50/20 dark:border-slate-800/40 dark:bg-slate-900/10 rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-200/40 dark:border-slate-800/40 pb-3.5 mb-3.5">
          <div>
            <div className="h-4 w-40 bg-slate-200 rounded dark:bg-slate-800" />
            <div className="h-3 w-64 bg-slate-100 rounded mt-1.5 dark:bg-slate-900" />
          </div>
          <div className="h-8 w-24 bg-slate-200 rounded-lg dark:bg-slate-800" />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white/40 dark:bg-slate-900/30 rounded-xl p-3 border border-slate-200/20 dark:border-slate-800/20">
              <div className="h-2.5 w-24 bg-slate-200 rounded dark:bg-slate-800" />
              <div className="h-6 w-16 bg-slate-300 rounded-md mt-2 dark:bg-slate-700" />
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions skeleton */}
      <div className="mt-6">
        <div className="mb-4">
          <div className="h-5 w-32 bg-slate-200 rounded dark:bg-slate-800" />
          <div className="h-3 w-48 bg-slate-100 rounded mt-1.5 dark:bg-slate-900" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="flex min-h-24 items-center gap-4 p-4 rounded-2xl border border-slate-200/40 bg-white/50 dark:border-slate-800/40 dark:bg-slate-900/50"
            >
              <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-200 dark:bg-slate-800" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-3.5 w-24 bg-slate-200 rounded dark:bg-slate-800" />
                <div className="h-3 w-32 bg-slate-100 rounded dark:bg-slate-900" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Roster & Analytics layout skeleton */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 p-5 border border-slate-200/40 bg-white/50 dark:border-slate-800/40 dark:bg-slate-900/50 rounded-2xl min-h-64 flex flex-col justify-between">
          <div className="h-4 w-40 bg-slate-200 rounded dark:bg-slate-800" />
          <div className="h-40 w-full bg-slate-100 rounded-xl dark:bg-slate-900 mt-4" />
        </div>
        <div className="p-5 border border-slate-200/40 bg-white/50 dark:border-slate-800/40 dark:bg-slate-900/50 rounded-2xl min-h-64 flex flex-col justify-between">
          <div className="h-4 w-32 bg-slate-200 rounded dark:bg-slate-800" />
          <div className="h-40 w-full bg-slate-100 rounded-xl dark:bg-slate-900 mt-4" />
        </div>
      </div>
    </div>
  );
}

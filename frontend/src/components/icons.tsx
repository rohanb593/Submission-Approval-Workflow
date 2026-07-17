export function InboxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 9.776c0-.376.098-.746.284-1.072l2.475-4.328A2.25 2.25 0 018.61 3.375h6.78a2.25 2.25 0 011.101 1.001l2.475 4.328c.186.326.284.696.284 1.072V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18V9.776z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.75h4.5l1.5 2.25h4.5l1.5-2.25h4.5" />
    </svg>
  );
}

export function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
      />
    </svg>
  );
}

export function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <circle cx={12} cy={12} r={8.25} />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5V12l3 2.25" />
    </svg>
  );
}

export function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75l1.5 1.5 4.5-4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

export function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export function AlertTriangleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m0 3h.008M10.29 3.86L1.82 18a1.5 1.5 0 001.29 2.25h17.78a1.5 1.5 0 001.29-2.25L13.71 3.86a1.5 1.5 0 00-2.42 0z"
      />
    </svg>
  );
}

export function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 19.5v-1.125a3.375 3.375 0 00-3.375-3.375h-3.75A3.375 3.375 0 004.5 18.375V19.5m15 0v-1.125a3 3 0 00-2.25-2.906M15 9.75a3 3 0 10-3-3m6.75 5.25a3 3 0 10-3-3M11.25 9.75a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

export function FilterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.958a2.25 2.25 0 00-.659-1.591L3.659 6.409A2.25 2.25 0 013 4.818V3.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
    </svg>
  );
}

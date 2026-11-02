import React from 'react';

export interface KbdProps extends React.HTMLAttributes<HTMLElement> {}

export const Kbd: React.FC<KbdProps> = ({ children, className = '', ...props }) => {
  return (
    <kbd
      className={`inline-flex items-center justify-center font-mono text-[10px] font-medium leading-none text-[#8A8F98] bg-white/[0.06] border border-white/[0.1] rounded px-1.5 py-0.5 shadow-[inset_0_-1px_0_rgba(0,0,0,0.3)] select-none ${className}`}
      {...props}
    >
      {children}
    </kbd>
  );
};

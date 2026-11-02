import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'brand' | 'cyan' | 'outline';
  size?: 'xs' | 'sm';
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'xs',
  icon,
  className = '',
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center font-mono font-medium rounded border select-none shrink-0 tracking-tight transition-colors';

  const sizeStyles = {
    xs: 'px-1.5 py-0.5 text-[9.5px] gap-1',
    sm: 'px-2 py-0.5 text-[11px] gap-1.5',
  }[size];

  const variantStyles = {
    default: 'bg-white/[0.06] text-neutral-300 border-white/[0.1]',
    success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-[0_0_8px_rgba(52,211,153,0.2)]',
    warning: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    error: 'bg-rose-500/15 text-rose-300 border-rose-500/30 shadow-[0_0_8px_rgba(244,63,94,0.2)]',
    brand: 'bg-[#5E6AD2]/15 text-[#8A95FF] border-[#5E6AD2]/30',
    cyan: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    outline: 'bg-transparent text-neutral-400 border-white/[0.12]',
  }[variant];

  return (
    <span className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`} {...props}>
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </span>
  );
};

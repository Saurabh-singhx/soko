import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'xs' | 'sm' | 'md';
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'secondary',
      size = 'sm',
      icon,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium font-sans select-none rounded-lg transition-all duration-150 cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5E6AD2] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100';

    const sizeStyles = {
      xs: 'px-2 py-0.5 text-[11px] gap-1',
      sm: 'px-2.5 py-1 text-xs gap-1.5',
      md: 'px-3.5 py-1.5 text-xs gap-2',
    }[size];

    const variantStyles = {
      primary:
        'bg-[#5E6AD2] hover:bg-[#6875E8] text-white border border-white/15 shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.2)]',
      secondary:
        'bg-white/[0.05] hover:bg-white/[0.09] text-white border border-white/[0.08] hover:border-white/[0.16]',
      ghost:
        'bg-transparent hover:bg-white/[0.08] text-neutral-300 hover:text-white',
      danger:
        'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 hover:border-rose-500/50 shadow-[0_0_12px_rgba(244,63,94,0.2)]',
      success:
        'bg-emerald-500 hover:bg-emerald-400 text-black font-semibold shadow-[0_0_12px_rgba(52,211,153,0.35)]',
    }[variant];

    return (
      <button
        ref={ref}
        data-no-drag="true"
        disabled={disabled}
        className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
        {...props}
      >
        {icon && <span className="shrink-0">{icon}</span>}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

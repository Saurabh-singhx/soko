import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  glow?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ children, hoverable = false, glow = false, className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`bg-white/[0.035] border border-white/[0.08] rounded-xl p-3 backdrop-blur-xl transition-all duration-200 ${
          hoverable ? 'hover:bg-white/[0.06] hover:border-white/[0.14]' : ''
        } ${glow ? 'shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)]' : ''} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

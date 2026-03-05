import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      disabled,
      className,
      children,
      ...rest
    },
    ref
  ) => {
    const variantClass =
      variant === 'icon' ? 'btn-icon' : `btn-${variant}`;
    const sizeClass = variant === 'icon' ? '' : `btn-${size}`;
    const loadingClass = loading ? 'btn-loading' : '';

    const classes = [variantClass, sizeClass, loadingClass, className]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        ref={ref}
        className={classes}
        disabled={disabled || loading}
        {...rest}
      >
        {loading ? (
          <Loader2 size={14} className="spin" />
        ) : leftIcon ? (
          leftIcon
        ) : null}
        {children}
        {rightIcon && !loading ? rightIcon : null}
      </button>
    );
  }
);

Button.displayName = 'Button';

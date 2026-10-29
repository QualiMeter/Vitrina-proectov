import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

type Variant = 'primary' | 'secondary' | 'ghost';
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant };
type ButtonLinkProps = LinkProps & { variant?: Variant; children: ReactNode };

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return <button className={`button button--${variant} ${className}`} {...props} />;
}

export function ButtonLink({ variant = 'primary', className = '', ...props }: ButtonLinkProps) {
  return <Link className={`button button--${variant} ${className}`} {...props} />;
}

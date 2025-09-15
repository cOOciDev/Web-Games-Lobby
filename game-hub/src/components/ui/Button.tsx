import React from 'react'

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'danger' | 'ghost'
}

const map: Record<NonNullable<Props['variant']>, string> = {
  primary: 'btn--primary',
  danger: 'btn--danger',
  ghost: 'btn--ghost',
}

export default function Button({ variant = 'primary', className = '', ...rest }: Props) {
  const variantClass = map[variant]
  return <button className={`btn ${variantClass} ${className}`} {...rest} />
}

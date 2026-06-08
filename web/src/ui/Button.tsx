import { ButtonHTMLAttributes } from 'react'

export function Button({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      style={{
        background: 'var(--teal)', color: 'var(--cream)', border: 'none',
        borderRadius: 999, padding: '.7rem 1.4rem', fontWeight: 600, fontSize: '.95rem',
        cursor: 'pointer', opacity: props.disabled ? 0.5 : 1, ...(props.style ?? {}),
      }}
    >
      {children}
    </button>
  )
}

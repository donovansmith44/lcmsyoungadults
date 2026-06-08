import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ProgressBar } from './ProgressBar'

describe('ProgressBar', () => {
  it('shows "Question X of N" and a bar filled to the right fraction', () => {
    render(<ProgressBar current={18} total={32} />)
    expect(screen.getByText('Question 18 of 32')).toBeInTheDocument()
    const fill = screen.getByTestId('progress-fill')
    expect(fill).toHaveStyle({ width: `${(18 / 32) * 100}%` })
  })
})

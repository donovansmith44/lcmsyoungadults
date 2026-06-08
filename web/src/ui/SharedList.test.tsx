import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { SharedList } from './SharedList'

describe('SharedList', () => {
  it('renders each sharer with a clean (underline-free) teal type link', () => {
    render(<SharedList entries={[{ username: 'maria', type: 'ENFP' }]} />)
    const link = screen.getByRole('link', { name: 'ENFP' })
    expect(link).toHaveAttribute('href', 'https://www.16personalities.com/enfp-personality')
    expect(link).toHaveClass('clean')
    expect(screen.getByText('maria')).toBeInTheDocument()
  })
})

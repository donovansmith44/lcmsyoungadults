import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DeleteConfirm } from './DeleteConfirm'

describe('DeleteConfirm', () => {
  it('enables delete only when the user types DELETE exactly', () => {
    const onConfirm = vi.fn()
    render(<DeleteConfirm name="Personality Day" onConfirm={onConfirm} onCancel={() => {}} />)
    const btn = screen.getByRole('button', { name: /^delete$/i })
    expect(btn).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'delete' } })
    expect(btn).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'DELETE' } })
    expect(btn).toBeEnabled()
    fireEvent.click(btn)
    expect(onConfirm).toHaveBeenCalled()
  })
})

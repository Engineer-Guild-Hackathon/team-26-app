import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders Vite + React heading', () => {
    render(<App />)
    const heading = screen.getByRole('heading', { name: /vite \+ react/i })
    expect(heading).toBeInTheDocument()
  })

  it('renders count button', () => {
    render(<App />)
    const button = screen.getByRole('button', { name: /count is 0/i })
    expect(button).toBeInTheDocument()
  })
})

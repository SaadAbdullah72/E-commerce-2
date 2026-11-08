import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

describe('test setup', () => {
  it('renders a component and supports jest-dom matchers', () => {
    render(<button>Hello</button>)
    expect(screen.getByRole('button', { name: 'Hello' })).toBeInTheDocument()
  })
})

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import Home from './Home'
import type { Module, Quota } from '../services/api'

const quota: Quota = { limit: 1_000_000, used: 245_000, remaining: 755_000, reserved: 0, resetDate: '2027-01-01T00:00:00Z', asOf: '2026-12-01T00:00:00Z', scope: 'user' }
const modules: Module[] = [{ moduleName: 'spark', displayName: 'Spark', description: 'Planning knowledge', isEnabled: true, features: [] }]

afterEach(cleanup)

describe('Home dashboard', () => {
  it('displays API quota and only the supplied assigned modules', () => {
    const open = vi.fn()
    render(<Home modules={modules} quota={quota} breakdown={[{ moduleName: 'spark', totalTokens: 100_000 }]} onOpen={open} onRetry={vi.fn()} launching={null} />)
    expect(screen.getByText('755,000')).toBeTruthy()
    expect(screen.getByText('100,000 tokens used')).toBeTruthy()
    expect(screen.queryByText('MatchPoint')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /open spark/i }))
    expect(open).toHaveBeenCalledWith(modules[0])
  })

  it('allows retry when no modules are assigned and handles zero allocation', () => {
    const retry = vi.fn()
    render(<Home modules={[]} quota={{ ...quota, limit: 0, used: 0, remaining: 0 }} breakdown={[]} onOpen={vi.fn()} onRetry={retry} launching={null} />)
    expect(screen.getByText('No allocation available')).toBeTruthy()
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(retry).toHaveBeenCalledOnce()
  })
})

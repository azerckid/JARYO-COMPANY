import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AUTH_INPUT_CLASS, AUTH_PASSWORD_INPUT_CLASS } from './auth-field-classes'

const root = process.cwd()

describe('auth field contrast (JC-045 public light isolation)', () => {
  it('forces readable light field text and background', () => {
    expect(AUTH_INPUT_CLASS).toContain('bg-white')
    expect(AUTH_INPUT_CLASS).toContain('text-gray-900')
    expect(AUTH_INPUT_CLASS).toContain('caret-gray-900')
    expect(AUTH_PASSWORD_INPUT_CLASS).toContain('pr-10')
  })

  it('wires sign-in, sign-up and password fields to the shared light classes', () => {
    const signIn = readFileSync(join(root, 'app/(auth)/sign-in/page.tsx'), 'utf8')
    const signUp = readFileSync(join(root, 'app/(auth)/sign-up/page.tsx'), 'utf8')
    const password = readFileSync(
      join(root, 'app/(auth)/_components/password-visibility-input.tsx'),
      'utf8',
    )
    const layout = readFileSync(join(root, 'app/(auth)/layout.tsx'), 'utf8')

    expect(signIn).toContain('AUTH_INPUT_CLASS')
    expect(signUp).toContain('AUTH_INPUT_CLASS')
    expect(password).toContain('AUTH_PASSWORD_INPUT_CLASS')
    expect(layout).toContain("colorScheme: 'light'")
  })
})

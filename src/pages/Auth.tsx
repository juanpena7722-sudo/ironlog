import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { z } from 'zod'
import { LoginSchema, RegisterSchema } from '@shared/schemas'
import { errorMessage, useSession, useSignIn } from '../api/auth'
import { Card, Field } from '../components/ui'

type Mode = 'login' | 'register'
type FieldErrors = { email?: string[]; password?: string[] }

const REDIRECT_STATE_SCHEMA = z.object({ from: z.string().startsWith('/') })

const COPY = {
  login: {
    title: 'Log in',
    submit: 'Log in',
    passwordAutoComplete: 'current-password',
    switchText: 'No account yet?',
    switchLink: 'Create one',
    switchTo: '/register',
  },
  register: {
    title: 'Create account',
    submit: 'Create account',
    passwordAutoComplete: 'new-password',
    switchText: 'Already have an account?',
    switchLink: 'Log in',
    switchTo: '/login',
  },
} as const

export default function Auth({ mode }: { mode: Mode }) {
  const location = useLocation()
  const session = useSession()
  const signIn = useSignIn(mode)
  const [errors, setErrors] = useState<FieldErrors>({})
  const copy = COPY[mode]
  const redirect = REDIRECT_STATE_SCHEMA.safeParse(location.state)

  if (session.data) return <Navigate to={redirect.success ? redirect.data.from : '/'} replace />

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const result = (mode === 'login' ? LoginSchema : RegisterSchema).safeParse({
      email: form.get('email'),
      password: form.get('password'),
    })
    if (!result.success) {
      const fieldErrors = z.flattenError(result.error).fieldErrors
      setErrors(fieldErrors)
      const firstInvalid = event.currentTarget.elements.namedItem(
        fieldErrors.email ? 'email' : 'password',
      )
      if (firstInvalid instanceof HTMLInputElement) firstInvalid.focus()
      return
    }
    setErrors({})
    signIn.mutate(result.data)
  }

  return (
    <main className="auth">
      <div className="brand">
        Iron<span>Log</span>
      </div>
      <Card>
        <h1>{copy.title}</h1>
        <form onSubmit={submit} noValidate>
          <Field
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            error={errors.email?.[0]}
          />
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete={copy.passwordAutoComplete}
            error={errors.password?.[0]}
          />
          {signIn.error && (
            <p role="alert" className="field-error">
              {errorMessage(signIn.error)}
            </p>
          )}
          <button type="submit" disabled={signIn.isPending}>
            {copy.submit}
          </button>
        </form>
        <p className="small muted">
          {copy.switchText}{' '}
          <Link to={copy.switchTo} state={location.state}>
            {copy.switchLink}
          </Link>
        </p>
      </Card>
    </main>
  )
}

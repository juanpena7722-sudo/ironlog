import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import type { FoodEntry } from '../types'
import { mockCollection } from '../test/mockApi'
import { renderWithProviders } from '../test/render'
import { server } from '../test/setup'
import { daysAgo, today } from '../utils'
import Diet from './Diet'

const OATS: FoodEntry = {
  id: '9c0b7a3e-2d1f-4e5a-8b6c-7d8e9f0a1b2c',
  date: today(),
  meal: 'Breakfast',
  name: 'Oats',
  calories: 400,
  protein: 20,
  carbs: 60,
  fat: 8,
}

describe('Diet', () => {
  it("lists the day's foods and queries the day and the last 14 days", async () => {
    const old = { ...OATS, id: '1c0b7a3e-2d1f-4e5a-8b6c-7d8e9f0a1b2c', date: daysAgo(20) }
    const api = mockCollection('foods', [OATS, old])
    renderWithProviders(<Diet />)

    expect(await screen.findByText('Oats')).toBeDefined()
    expect(screen.getAllByText('400 kcal · 20P / 60C / 8F')).toHaveLength(2)
    expect(await screen.findByText('2100 kcal left · 160 g protein to go')).toBeDefined()
    const searches = api.requests.map((r) => r.url.search)
    expect(searches).toContain(`?from=${today()}&to=${today()}`)
    expect(searches).toContain(`?from=${daysAgo(13)}`)
  })

  it('adds a food with calories from macros', async () => {
    const api = mockCollection<FoodEntry>('foods', [])
    renderWithProviders(<Diet />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Food'), 'Rice')
    await user.selectOptions(screen.getByLabelText('Meal'), 'Lunch')
    await user.type(screen.getByLabelText('Carbs (g)'), '50')
    await user.type(screen.getByLabelText('Protein (g)'), '5')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByText('Rice')).toBeDefined()
    expect(api.requests.find((r) => r.method === 'POST')?.body).toMatchObject({
      date: today(),
      meal: 'Lunch',
      name: 'Rice',
      calories: 220,
      protein: 5,
      carbs: 50,
      fat: 0,
    })
    expect(screen.getByLabelText('Food')).toHaveProperty('value', '')
  })

  it('quick-adds a recent food to the selected meal', async () => {
    server.use(http.get('/api/v1/foods/recent', () => HttpResponse.json([OATS])))
    const api = mockCollection<FoodEntry>('foods', [])
    renderWithProviders(<Diet />)
    const user = userEvent.setup()

    await user.selectOptions(screen.getByLabelText('Meal'), 'Snack')
    await user.click(await screen.findByRole('button', { name: '+ Oats' }))

    expect(await screen.findByText('Snack', { selector: 'strong' })).toBeDefined()
    expect(api.requests.find((r) => r.method === 'POST')?.body).toMatchObject({
      name: 'Oats',
      meal: 'Snack',
      date: today(),
    })
  })

  it('deletes a food', async () => {
    const api = mockCollection('foods', [OATS])
    renderWithProviders(<Diet />)

    await userEvent.setup().click(await screen.findByRole('button', { name: '✕' }))

    expect(await screen.findByText('Nothing logged for this day.')).toBeDefined()
    expect(api.requests.find((r) => r.method === 'DELETE')?.url.pathname).toBe(
      `/api/v1/foods/${OATS.id}`,
    )
  })
})

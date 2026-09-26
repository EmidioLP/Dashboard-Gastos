import { addMonths, format, parse } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export const formatMoney = (value: number) => currency.format(value)

export const monthKey = (date: Date) => format(date, 'yyyy-MM')

export const currentMonth = () => monthKey(new Date())

export const today = () => format(new Date(), 'yyyy-MM-dd')

export const parseMonth = (month: string) => parse(month, 'yyyy-MM', new Date())

export const shiftMonth = (month: string, delta: number) => monthKey(addMonths(parseMonth(month), delta))

export const formatMonthLabel = (month: string) => {
  const label = format(parseMonth(month), 'MMMM yyyy', { locale: ptBR })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export const formatDay = (date: string) =>
  format(parse(date, 'yyyy-MM-dd', new Date()), "dd 'de' MMM", { locale: ptBR })

export const uid = () => crypto.randomUUID()

/** Parses "1.234,56", "1.500", "1234.56" or "1234,5" into a number. */
export const parseAmount = (raw: string): number => {
  const s = raw.trim().replace(/[R$\s]/g, '')
  if (!s) return NaN
  // without a comma, dots in groups of three are thousands separators ("1.500" is 1500)
  const normalized = s.includes(',')
    ? s.replace(/\./g, '').replace(',', '.')
    : /^[1-9]\d{0,2}(\.\d{3})+$/.test(s)
      ? s.replace(/\./g, '')
      : s
  return Number(normalized)
}

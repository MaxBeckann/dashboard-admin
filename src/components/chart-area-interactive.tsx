'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts'
import { getDashboardStats } from '@/lib/admin-api'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export const description = 'Novos cadastros ao longo do tempo'

const chartConfig = {
  count: {
    label: 'Cadastros',
    color: 'var(--primary)',
  },
} satisfies ChartConfig

// `yyyy-MM-dd` → `dd/MM`
function fmtDay(value: string) {
  const parts = String(value).split('-')
  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : String(value)
}

export function ChartAreaInteractive() {
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState('30d')

  React.useEffect(() => {
    if (isMobile) setTimeRange('7d')
  }, [isMobile])

  const { data: s } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: getDashboardStats,
    refetchInterval: 30_000,
  })

  const days = timeRange === '30d' ? 30 : timeRange === '7d' ? 7 : 90
  const filteredData = (s?.signups ?? []).slice(-days)

  return (
    <Card className='@container/card'>
      <CardHeader>
        <CardTitle>Novos cadastros</CardTitle>
        <CardDescription>
          <span className='hidden @[540px]/card:block'>
            Total dos últimos {days} dias
          </span>
          <span className='@[540px]/card:hidden'>Últimos {days}d</span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type='single'
            value={timeRange}
            onValueChange={(v) => v && setTimeRange(v)}
            variant='outline'
            className='hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex'
          >
            <ToggleGroupItem value='90d'>3 meses</ToggleGroupItem>
            <ToggleGroupItem value='30d'>30 dias</ToggleGroupItem>
            <ToggleGroupItem value='7d'>7 dias</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className='flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden'
              size='sm'
              aria-label='Período'
            >
              <SelectValue placeholder='30 dias' />
            </SelectTrigger>
            <SelectContent className='rounded-xl'>
              <SelectItem value='90d' className='rounded-lg'>
                3 meses
              </SelectItem>
              <SelectItem value='30d' className='rounded-lg'>
                30 dias
              </SelectItem>
              <SelectItem value='7d' className='rounded-lg'>
                7 dias
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className='px-2 pt-4 sm:px-6 sm:pt-6'>
        <ChartContainer
          config={chartConfig}
          className='aspect-auto h-[250px] w-full'
        >
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id='fillCount' x1='0' y1='0' x2='0' y2='1'>
                <stop
                  offset='5%'
                  stopColor='var(--color-count)'
                  stopOpacity={1.0}
                />
                <stop
                  offset='95%'
                  stopColor='var(--color-count)'
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey='date'
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={fmtDay}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => fmtDay(String(value))}
                  indicator='dot'
                />
              }
            />
            <Area
              dataKey='count'
              type='natural'
              fill='url(#fillCount)'
              stroke='var(--color-count)'
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

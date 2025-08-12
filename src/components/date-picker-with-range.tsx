"use client"

import { useState, Dispatch, SetStateAction } from "react"
import {
  endOfMonth,
  endOfYear,
  format,
  startOfMonth,
  startOfYear,
  subDays,
  subMonths,
  subYears,
} from "date-fns"
import { DateRange } from "react-day-picker"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { CalendarIcon } from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"

interface DatePickerWithRangeProps {
  date: DateRange | undefined
  setDate: Dispatch<SetStateAction<DateRange | undefined>> | ((date: DateRange | undefined) => void)
  className?: string
}

export default function DatePickerWithRange({ date, setDate, className }: DatePickerWithRangeProps) {
  const today = new Date()
  const yesterday = {
    from: subDays(today, 1),
    to: subDays(today, 1),
  }
  const last7Days = {
    from: subDays(today, 6),
    to: today,
  }
  const last30Days = {
    from: subDays(today, 29),
    to: today,
  }
  const monthToDate = {
    from: startOfMonth(today),
    to: today,
  }
  const lastMonth = {
    from: startOfMonth(subMonths(today, 1)),
    to: endOfMonth(subMonths(today, 1)),
  }
  const yearToDate = {
    from: startOfYear(today),
    to: today,
  }
  const lastYear = {
    from: startOfYear(subYears(today, 1)),
    to: endOfYear(subYears(today, 1)),
  }
  const [month, setMonth] = useState(today)
  const isMobile = useIsMobile()

  return (
    <div className={className}>
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <Popover>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start">
                  <CalendarIcon
                    size={16}
                    className="opacity-40 -ms-1 group-hover:text-foreground shrink-0 transition-colors mr-2"
                    aria-hidden="true"
                  />
                  <span className={cn("truncate", !date && "text-muted-foreground")}>
                    {date?.from ? (
                      date.to ? (
                        <>
                          {format(date.from, "dd/MM/yyyy")} - {format(date.to, "dd/MM/yyyy")}
                        </>
                      ) : (
                        format(date.from, "dd/MM/yyyy")
                      )
                    ) : (
                      "Selecionar período"
                    )}
                  </span>
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent className="lg:hidden" hidden={isMobile}>
              Selecionar período
            </TooltipContent>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="flex max-sm:flex-col">
                <div className="relative py-4 max-sm:order-1 max-sm:border-t sm:w-40">
                  <div className="h-full sm:border-e">
                    <div className="flex flex-col px-3 space-y-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-left font-normal"
                        onClick={() => {
                          setDate({
                            from: today,
                            to: today,
                          })
                          setMonth(today)
                        }}
                      >
                        Hoje
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-left font-normal"
                        onClick={() => {
                          setDate(yesterday)
                          setMonth(yesterday.to)
                        }}
                      >
                        Ontem
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-left font-normal"
                        onClick={() => {
                          setDate(last7Days)
                          setMonth(last7Days.to)
                        }}
                      >
                        Últimos 7 dias
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-left font-normal"
                        onClick={() => {
                          setDate(last30Days)
                          setMonth(last30Days.to)
                        }}
                      >
                        Últimos 30 dias
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-left font-normal"
                        onClick={() => {
                          setDate(monthToDate)
                          setMonth(monthToDate.to)
                        }}
                      >
                        Mês atual
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-left font-normal"
                        onClick={() => {
                          setDate(lastMonth)
                          setMonth(lastMonth.to)
                        }}
                      >
                        Mês anterior
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-left font-normal"
                        onClick={() => {
                          setDate(yearToDate)
                          setMonth(yearToDate.to)
                        }}
                      >
                        Ano atual
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-left font-normal"
                        onClick={() => {
                          setDate(lastYear)
                          setMonth(lastYear.to)
                        }}
                      >
                        Ano anterior
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="p-2">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={month}
                    selected={date}
                    onSelect={setDate}
                    numberOfMonths={2}
                    className="max-sm:w-full"
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}

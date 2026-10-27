import { useMemo } from 'react'
import type { CalendarDay } from '../../lib/date-utils'
import type { GameEvent } from '../../types/events'
import { WEEKDAY_LABELS } from '../../lib/constants'
import { computeEventSegments } from '../../lib/event-layout'

// 色条与日期行的几何放在 CSS 变量里（--cal-*，见 index.css）：
// 桌面值等于原来的常量，手机端由媒体查询放大，便于点按。

interface CalendarGridProps {
  weeks: CalendarDay[][]
  events: GameEvent[]
  selectedDate: string | null
  onSelectDate: (date: string) => void
  onSelectEvent?: (date: string, eventId: string) => void
}

/**
 * 日历月视图网格组件 — Paimon.moe 风格
 *
 * 三层渲染架构：
 *   Layer 1 (z-0):  格子背景（今日高亮、选中态），全高可点击
 *   Layer 2 (z-10): 活动色条，日期行下方，容器 pointer-events-none
 *   Layer 3 (z-20): 日期数字，顶部固定高度，pointer-events-none
 */
export function CalendarGrid({ weeks, events, selectedDate, onSelectDate, onSelectEvent }: CalendarGridProps) {
  const weekSegments = useMemo(
    () => computeEventSegments(weeks, events),
    [weeks, events],
  )

  return (
    <div className="flex-1 flex flex-col px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] md:px-6 md:pb-6">
      {/* ===== 星期头 ===== */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_LABELS.map((label, i) => (
          <div
            key={i}
            className="text-center text-xs font-medium py-1 md:text-sm md:py-2"
            style={{ color: 'var(--text-secondary)' }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* ===== 日历主体（按周分行） ===== */}
      <div
        className="flex flex-col flex-1 border-t border-l rounded-lg overflow-hidden"
        style={{ borderColor: 'var(--border-color)' }}
      >
        {weeks.map((week, wi) => {
          const segs = weekSegments[wi]
          const maxLane = segs.length > 0 ? Math.max(...segs.map((s) => s.lane)) : 0
          const barsAreaH = segs.length > 0
            ? `calc(${maxLane + 1} * var(--cal-bar-lane-height) + 4px)`
            : undefined
          const rowMinH = segs.length > 0
            ? `calc(var(--cal-bar-top) + ${maxLane + 1} * var(--cal-bar-lane-height) + 8px)`
            : 'var(--cal-min-cell-height)'

          return (
            <div
              key={wi}
              className="relative flex-1 border-b"
              style={{
                borderColor: 'var(--border-color)',
                minHeight: rowMinH,
              }}
            >
              {/* ======== Layer 1: 格子背景 (z-0) — 填充整行 ======== */}
              <div className="grid grid-cols-7 absolute inset-0 z-0">
                {week.map((day) => {
                  const isSelected = day.date === selectedDate
                  return (
                    <button
                      key={day.date}
                      onClick={() => onSelectDate(day.date)}
                      className={`
                        border-r text-left transition-colors
                        ${!day.isCurrentMonth ? 'opacity-35' : ''}
                        ${isSelected ? 'ring-2 ring-inset' : ''}
                        hover:bg-gray-50 dark:hover:bg-gray-800/50
                      `}
                      style={{
                        borderColor: 'var(--border-color)',
                        backgroundColor: day.isToday
                          ? 'var(--today-bg)'
                          : isSelected
                            ? 'var(--bg-hover)'
                            : 'transparent',
                        '--tw-ring-color': '#6366F1',
                      } as React.CSSProperties}
                    />
                  )
                })}
              </div>

              {/* ======== Layer 2: 活动色条 (z-10) — 日期行下方 ======== */}
              {segs.length > 0 && (
                <div
                  className="absolute inset-x-0 z-10 pointer-events-none"
                  style={{ top: 'var(--cal-bar-top)', height: barsAreaH }}
                >
                  {segs.map((seg) => {
                    const leftPct = (seg.startCol / 7) * 100
                    const widthPct = ((seg.endCol - seg.startCol + 1) / 7) * 100
                    const borderRadius = [
                      seg.isStart ? '6px' : '2px',
                      seg.isEnd ? '6px' : '2px',
                      seg.isEnd ? '6px' : '2px',
                      seg.isStart ? '6px' : '2px',
                    ].join(' ')

                    return (
                      <button
                        key={seg.eventId}
                        className="absolute flex items-center px-1.5 max-md:px-1 overflow-hidden select-none pointer-events-auto cursor-pointer hover:brightness-95 transition-[filter]"
                        style={{
                          left: `${leftPct}%`,
                          width: `calc(${widthPct}% - 4px)`,
                          top: `calc(${seg.lane} * var(--cal-bar-lane-height))`,
                          height: 'var(--cal-bar-height)',
                          borderRadius,
                          ...(seg.bgImage
                            ? {
                                backgroundImage: `url(${seg.bgImage})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                              }
                            : {
                                backgroundColor: seg.color,
                                border: '1px solid rgba(0,0,0,0.08)',
                              }),
                        }}
                        title={seg.title}
                        aria-label={seg.title}
                        onClick={() => onSelectEvent?.(week[seg.startCol].date, seg.eventId)}
                      >
                        {seg.bgImage && (
                          <div
                            className="absolute inset-0"
                            style={{ backgroundColor: 'rgba(0,0,0,0.45)', borderRadius }}
                          />
                        )}
                        <span
                          className="relative z-10 text-[11px] truncate font-medium leading-none"
                          style={{ color: seg.bgImage ? '#fff' : '#1E293B' }}
                        >
                          {seg.title}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* ======== Layer 3: 日期数字 (z-20) — 顶部固定高度 ======== */}
              <div
                className="grid grid-cols-7 absolute top-0 inset-x-0 z-20 pointer-events-none"
                style={{ height: 'var(--cal-date-line-height)' }}
              >
                {week.map((day) => (
                  <div key={day.date} className="p-1.5 border-r flex items-start">
                    {day.isToday ? (
                      <span className="w-6 h-6 rounded-full bg-[var(--today-border)] text-white text-xs font-bold flex items-center justify-center leading-none">
                        {day.day}
                      </span>
                    ) : (
                      <span
                        className={`text-sm font-medium ${!day.isCurrentMonth ? 'opacity-35' : ''}`}
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {day.day}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

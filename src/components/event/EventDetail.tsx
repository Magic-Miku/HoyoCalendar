import { useEffect } from 'react'
import type { GameEvent, EventTypeId } from '../../types/events'
import { GAME_META, EVENT_TYPE_META } from '../../types/events'

// 桌面：320px 内联侧栏；手机：底部抽屉（背板在 App 里）
const PANEL_CLASS =
  'w-80 border-l p-4 overflow-y-auto ' +
  'max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-50 max-md:w-full ' +
  'max-md:max-h-[85dvh] max-md:rounded-t-2xl max-md:border-l-0 max-md:border-t max-md:shadow-2xl max-md:overscroll-contain ' +
  'max-md:pb-[calc(1rem+env(safe-area-inset-bottom))]'

interface EventDetailProps {
  events: GameEvent[]
  date: string
  highlightedEventId?: string | null
  isCompleted?: (eventId: string) => boolean
  onToggleComplete?: (eventId: string) => void
  onClose: () => void
}

export function EventDetail({ events, date, highlightedEventId, isCompleted, onToggleComplete, onClose }: EventDetailProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  if (events.length === 0) {
    return (
      <aside
        className={PANEL_CLASS}
        aria-label={`${date} 活动详情`}
        style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-surface)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            {date}
          </h3>
          <button
            onClick={onClose}
            aria-label="关闭详情"
            className="text-sm max-md:flex max-md:min-h-11 max-md:min-w-11 max-md:items-center max-md:justify-center max-md:rounded-lg max-md:text-lg"
            style={{ color: 'var(--text-muted)' }}
          >
            ✕
          </button>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          当日无活动
        </p>
      </aside>
    )
  }

  return (
    <aside
      className={PANEL_CLASS}
      aria-label={`${date} 活动详情`}
      style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-surface)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
          {date}
        </h3>
        <button
          onClick={onClose}
          aria-label="关闭详情"
          className="text-sm hover:opacity-70 max-md:flex max-md:min-h-11 max-md:min-w-11 max-md:items-center max-md:justify-center max-md:rounded-lg max-md:text-lg"
          style={{ color: 'var(--text-muted)' }}
        >
          ✕
        </button>
      </div>

      <ul className="space-y-3">
        {events.map((event) => {
          const gameMeta = GAME_META[event.game]
          const typeMeta = EVENT_TYPE_META[event.type as EventTypeId] ?? { icon: '📌', label: event.type }

          return (
            <li
              key={event.id}
              className={`rounded-lg p-3 border transition-all ${event.id === highlightedEventId ? 'ring-2 ring-blue-400 shadow-sm' : ''}`}
              style={{
                borderColor: event.id === highlightedEventId ? '#60A5FA' : 'var(--border-color)',
                opacity: isCompleted?.(event.id) ? 0.55 : 1,
              }}
            >
              {/* 游戏标签 + 类型标签 + 完成切换 */}
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                  style={{ backgroundColor: gameMeta.color }}
                >
                  {gameMeta.name}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {typeMeta.icon} {typeMeta.label}
                </span>
                <div className="flex-1" />
                {onToggleComplete && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleComplete(event.id) }}
                    className={`text-sm w-6 h-6 max-md:w-10 max-md:h-10 max-md:text-base rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      isCompleted?.(event.id)
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'border-gray-300 text-transparent hover:border-gray-400'
                    }`}
                    title={isCompleted?.(event.id) ? '标记为未完成' : '标记为完成'}
                    aria-label={isCompleted?.(event.id) ? '标记为未完成' : '标记为完成'}
                    aria-pressed={!!isCompleted?.(event.id)}
                  >
                    ✓
                  </button>
                )}
              </div>

              {/* 活动标题 */}
              <h4 className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                {event.title}
              </h4>

              {/* 时间范围 */}
              <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
                {event.start_date} ~ {event.end_date}
              </p>

              {/* 描述 */}
              {event.description && (
                <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                  {event.description}
                </p>
              )}

              {/* 链接 */}
              {event.source_url && (
                <a
                  href={event.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:underline inline-block mb-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  🔗 {new URL(event.source_url).hostname}
                </a>
              )}

              {/* 标签 */}
              {event.tags && event.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {event.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </aside>
  )
}

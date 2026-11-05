#!/usr/bin/env node
/**
 * 构建前数据校验（fork 自有文件，不改动上游代码）
 *
 *   node scripts/validate-data.mjs
 *
 * 背景：src/lib/data-loader.ts 用 safeParse，YAML 校验失败时只 console.error
 * 并 continue，页面会「静默」少掉一个游戏的全部活动；而 Vite 构建只把 YAML
 * 当 raw 文本打包，运行时才校验，所以 npm run build 也拦不住坏数据。
 * 这个脚本把校验提前到构建/推送之前，让坏数据直接让流水线失败。
 *
 * 维护提示：下面的 Zod schema 是 src/types/events.ts 的镜像（Node 无法直接
 * import .ts）。上游若修改 EventSchema / GameId，请同步更新本文件。
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { load as parseYaml } from 'js-yaml'
import { z } from 'zod'

// ===== 与 src/types/events.ts 保持一致 =====
const GameId = z.enum([
  'genshin-impact',
  'honkai-star-rail',
  'zenless-zone-zero',
  'tears-of-themis',
  'petit-planet',
])

const EventPhaseSchema = z.object({
  title: z.string().min(1),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

const EventSchema = z.object({
  id: z.string().min(1),
  game: GameId,
  title: z.string().min(1),
  type: z.string().min(1),
  description: z.string().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  bar_bg_image: z.string().optional(),
  banner_image: z.string().optional(),
  phases: z.array(EventPhaseSchema).optional(),
  tags: z.array(z.string()).optional(),
  source_url: z.string().url().optional(),
})

const EventDataFileSchema = z.array(EventSchema)

// ===== 业务规则（schema 未覆盖，但出错会静默影响日历）=====
function realDate(str) {
  const [y, m, d] = str.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  return dt.getTime()
}

const root = resolve(process.cwd())
const dataDir = join(root, 'data', 'events')
const files = readdirSync(dataDir).filter((f) => f.endsWith('.yaml')).sort()

if (files.length === 0) {
  console.error('✗ data/events/ 下没有找到任何 .yaml 文件')
  process.exit(1)
}

const allErrors = []
const seenIds = new Map()
let total = 0

for (const file of files) {
  const path = join(dataDir, file)
  const errors = []

  let parsed
  try {
    parsed = parseYaml(readFileSync(path, 'utf8'))
  } catch (err) {
    console.error(`✗ ${file}: YAML 解析失败 — ${err.message}`)
    allErrors.push({ file, path: '(文件)', message: `YAML 解析失败: ${err.message}` })
    continue
  }

  const result = EventDataFileSchema.safeParse(parsed)
  if (!result.success) {
    for (const issue of result.error.issues) {
      const where = issue.path.length ? issue.path.join('.') : '(根)'
      errors.push(`${where}: ${issue.message}`)
      allErrors.push({ file, path: where, message: issue.message })
    }
    console.error(`✗ ${file}: schema 校验失败`)
    for (const e of errors) console.error(`    ${e}`)
    continue
  }

  const events = result.data
  total += events.length

  events.forEach((e, i) => {
    const label = `${e.id || `#${i}`}`
    const start = realDate(e.start_date)
    const end = realDate(e.end_date)
    if (start === null || end === null) {
      const msg = `日期不是真实存在的日历日: ${e.start_date} ~ ${e.end_date}`
      errors.push(`${label}: ${msg}`)
      allErrors.push({ file, path: `${label}.date`, message: msg })
    } else if (start > end) {
      const msg = `开始日期晚于结束日期: ${e.start_date} > ${e.end_date}`
      errors.push(`${label}: ${msg}`)
      allErrors.push({ file, path: `${label}.date`, message: msg })
    }

    if (seenIds.has(e.id)) {
      const msg = `id 重复（已出现在 ${seenIds.get(e.id)}）`
      errors.push(`${label}: ${msg}`)
      allErrors.push({ file, path: `${label}.id`, message: msg })
    } else {
      seenIds.set(e.id, file)
    }

    for (const [pi, phase] of (e.phases ?? []).entries()) {
      const ps = realDate(phase.start_date)
      const pe = realDate(phase.end_date)
      if (ps === null || pe === null || ps > pe || (start !== null && ps < start) || (end !== null && pe > end)) {
        const msg = `子阶段「${phase.title}」(${phase.start_date} ~ ${phase.end_date}) 日期无效或超出活动区间`
        errors.push(`${label}.phases[${pi}]: ${msg}`)
        allErrors.push({ file, path: `${label}.phases[${pi}]`, message: msg })
      }
    }
  })

  if (errors.length) {
    console.error(`✗ ${file}: ${events.length} 条活动，${errors.length} 处业务规则问题`)
    for (const e of errors) console.error(`    ${e}`)
  } else {
    console.log(`✓ ${file}: ${events.length} 条活动`)
  }
}

if (allErrors.length) {
  console.error(`\n✗ 数据校验失败：共 ${allErrors.length} 处问题，涉及 ${new Set(allErrors.map((e) => e.file)).size} 个文件。已阻止部署。`)
  process.exit(1)
}

console.log(`\n✓ 数据校验通过：${files.length} 个文件，${total} 条活动，id 全局唯一。`)

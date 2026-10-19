import type { Cut } from './studio'
import { dialoguesToText } from './story'

/** SBD-32 콘티 내보내기: 장·컷·장면·대사를 글로 */
export function scriptText(title: string, cuts: Cut[]): string {
  const out = [title.trim() || 'TOONFLOW', '']
  let page = -1
  for (const c of cuts) {
    if (c.pageIndex !== page) {
      page = c.pageIndex
      out.push(`# ${page + 1}장`)
    }
    out.push(`## ${c.number}컷${c.panel.shot ? ` · ${c.panel.shot}` : ''}`)
    if (c.panel.scene.trim()) out.push(`장면: ${c.panel.scene.trim()}`)
    const d = dialoguesToText(c.panel.dialogues.map(x => ({ type: x.type, speaker: x.speaker ?? '', text: x.text })))
    if (d.trim()) out.push(d.trim())
    out.push('')
  }
  return `${out.join('\n').trimEnd()}\n`
}

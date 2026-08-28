import type { ModVisibility } from '../lib/api'
import { Field } from './ui'

const COPY: Record<ModVisibility, string> = {
  public: 'Listed in the Library and visible to everyone.',
  unlisted: 'Hidden from listings; anyone with the direct link can view it.',
  private: 'Visible and playable only by you.',
}

export default function ModVisibilityField({
  disabled = false,
  onChange,
  value,
}: {
  disabled?: boolean
  onChange: (visibility: ModVisibility) => void
  value: ModVisibility
}) {
  return (
    <Field label="Visibility" hint={COPY[value]}>
      <select
        aria-label="Mod visibility"
        className="input"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as ModVisibility)}
        value={value}
      >
        <option value="public">Public</option>
        <option value="unlisted">Unlisted</option>
        <option value="private">Private</option>
      </select>
    </Field>
  )
}

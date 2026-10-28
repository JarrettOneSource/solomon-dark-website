import NativeUiText from './NativeUiText.tsx'
import { NATIVE_UI_FONT_NAMES } from './native-ui-catalog.ts'

export default function NativeUiTypographyPreview() {
  return (
    <div
      data-native-ui-typography
      style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr', left: 60, position: 'absolute', right: 60, top: 125 }}
    >
      {NATIVE_UI_FONT_NAMES.map(font => (
        <section
          data-typography-font={font}
          key={font}
          style={{ background: '#17140f', border: '1px solid #8e783c', height: 130, padding: '6px 12px' }}
        >
          <code style={{ color: '#c7b990' }}>{font}</code>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', marginTop: 8 }}>
            <div>
              <small style={{ color: '#a99c7b' }}>Flow box</small>
              <div data-typography-box style={{ alignItems: 'center', border: '1px solid #514729', display: 'flex', height: 60, justifyContent: 'center' }}>
                <NativeUiText font={font} text="AV" tint={0xd9ba70} />
              </div>
            </div>
            <div>
              <small style={{ color: '#a99c7b' }}>Native baseline</small>
              <div data-typography-baseline style={{ height: 60, position: 'relative' }}>
                <span style={{ borderTop: '1px solid #514729', left: 0, position: 'absolute', right: 0, top: 40 }} />
                <NativeUiText align="center" font={font} placement="baseline" style={{ left: '50%', top: 40 }} text="AV" tint={0xd9ba70} />
              </div>
            </div>
          </div>
        </section>
      ))}
    </div>
  )
}

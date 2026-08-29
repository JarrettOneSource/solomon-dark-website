import type {
  WizardDiscipline,
  WizardElement,
} from './player-character.ts'

export const NATIVE_WIZARD_CLASS_TITLES: Readonly<Record<
  WizardElement,
  Readonly<Record<WizardDiscipline, string>>
>> = {
  ether: { body: 'SAGE', mind: 'SEER', arcane: 'OCCULTIST' },
  fire: { body: 'WARLOCK', mind: 'PYROMANCER', arcane: 'FIRE MAGE' },
  air: { body: 'STORMCALLER', mind: 'ASTROLOGER', arcane: 'STORM MAGE' },
  water: { body: 'ICEBINDER', mind: 'THAUMATURGE', arcane: 'FROST MAGE' },
  earth: { body: 'RITUALIST', mind: 'CHANNELER', arcane: 'EARTH MAGE' },
} as const

export function nativeWizardClassTitle(
  element: WizardElement,
  discipline: WizardDiscipline,
): string {
  return NATIVE_WIZARD_CLASS_TITLES[element][discipline]
}

export function wizardClassDisplayTitle(
  element: WizardElement,
  discipline: WizardDiscipline,
): string {
  return nativeWizardClassTitle(element, discipline)
    .split(' ')
    .map(word => `${word.charAt(0)}${word.slice(1).toLowerCase()}`)
    .join(' ')
}

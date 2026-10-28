import type {
  WizardDiscipline,
  WizardDisciplineChoice,
  WizardElement,
} from './player-character.ts'
import { isWizardElement } from './player-character.ts'

export const NATIVE_WIZARD_CLASS_TITLES: Readonly<Record<
  WizardElement,
  Readonly<Record<WizardDisciplineChoice, string>>
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
  // Retail 0x00658B40 falls back to WIZARD for every elemental second root.
  return isWizardElement(discipline) ? 'WIZARD' : NATIVE_WIZARD_CLASS_TITLES[element][discipline]
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

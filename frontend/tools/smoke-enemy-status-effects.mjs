process.env.SDR_SECONDARY_ABILITY_ID ||= '35'
process.env.SDR_SECONDARY_ABILITY_SCENE = 'boneyard'
process.env.SDR_STATUS_EFFECT_ACCEPTANCE = '1'

await import('./smoke-secondary-abilities.mjs')

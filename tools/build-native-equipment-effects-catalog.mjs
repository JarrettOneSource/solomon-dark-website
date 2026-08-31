import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const [sourcePath, outputPath] = process.argv.slice(2)
if (!sourcePath || !outputPath) {
  throw new Error(
    'usage: node tools/build-native-equipment-effects-catalog.mjs <native-item-catalog.json> <output.json>',
  )
}

const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'))
const compactEffect = (effect) => ({
  kind: effect.kind_id,
  magnitude: effect.magnitude,
  operator: effect.operator_id,
  target: effect.target_id ?? 0,
})

const output = {
  sets: source.item_sets.map((set) => ({
    effects: set.fx.map(compactEffect),
    memberRecipeIndices: set.item_source_indexes,
    name: set.name,
  })),
  items: source.items.map((item) => ({
    description: item.description,
    effects: item.fx.map(compactEffect),
    name: item.name,
  })),
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`)

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const source = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8')
const nativeUi = JSON.parse(source('../assets/game/native-ui-assets.json'))

test('accepting the offer enters the tutorial prelude without a control picker', () => {
  const menu = source('./MainMenuScene.tsx')
  const css = source('./tutorial.css')
  assert.match(menu, /titlePrompt === 'kill-wizard'[\s\S]*?else \{[\s\S]*?setTutorialOfferOpen\(false\)[\s\S]*?setScreen\('tutorial-prelude'\)/)
  assert.doesNotMatch(menu, /tutorial-controls|TutorialControlPicker|tutorialControlSelection|chooseTutorialControls/)
  assert.doesNotMatch(css, /tutorial-control-picker|tutorial-control-choice/)
  assert.equal(existsSync(new URL('./TutorialControlPicker.tsx', import.meta.url)), false)
})

test('declining the offer stays at title and routes the next new wizard through Create to Hub', () => {
  const menu = source('./MainMenuScene.tsx')
  const declineHandler = /onSecondary=\{\(\) => \{[\s\S]*?if \(titlePrompt === 'kill-wizard'\)[\s\S]*?else \{[\s\S]*?\n\s*\}\n\s*\}\}/.exec(menu)?.[0]
  assert.ok(declineHandler)
  assert.match(declineHandler, /setTutorialOfferOpen\(false\)/)
  assert.match(declineHandler, /setTutorialDeclined\(true\)/)
  assert.doesNotMatch(declineHandler, /continueNewGame|beginCreate|startCollegeIntro/)
  assert.match(
    menu,
    /collegeIntroPending = useMemo\([\s\S]*?!tutorialDeclined[\s\S]*?\[profileSave, tutorialDeclined\]/,
  )
  const startHub = menu.slice(menu.indexOf('const startHub ='), menu.indexOf('async function startCollegeIntro'))
  assert.match(
    startHub,
    /const saveDocument = transferSaveDocumentRef\.current \?\? profileSave\?\.document/,
  )
  assert.match(
    startHub,
    /const declineFreshTutorial = tutorialDeclined && saveDocument === undefined/,
  )
  assert.match(startHub, /connectSession\([\s\S]*?declineFreshTutorial/)
})

test('projects the complete pre-Create College chrome gate from authoritative lifecycle state', () => {
  const menu = source('./MainMenuScene.tsx')
  const hub = source('./HubScene.tsx')
  const hubRenderer = source('./renderer/hub-world-renderer.ts')
  const inventory = source('./HubInventoryUi.tsx')
  const css = source('./college-intro.css')

  assert.match(menu, /hubCollegeAdmissionPreLoadout\(/)
  assert.match(menu, /const collegeAdmissionHudHidden = screen === 'hub'[\s\S]*?hubCollegeAdmissionPreLoadout/)
  assert.match(menu, /gameplayHudHidden=\{collegeAdmissionHudHidden\}/)
  const chromeStart = menu.indexOf('{!collegeAdmissionHudHidden && <>')
  const chromeEnd = menu.indexOf(
    '{(preparing || leaving || resolvingPlayerCard || connectionError)',
    chromeStart,
  )
  assert.ok(chromeStart >= 0 && chromeEnd > chromeStart)
  const chrome = menu.slice(chromeStart, chromeEnd)
  for (const member of [
    'ModMinimap',
    'ModPanels',
    'ModSceneOverlay',
    'GameChat',
    'SkillBook',
    'HudSkillSelector',
    'SkillPicker',
    'GameplayResumeProgress',
    'GameplayPauseMenu',
    'GameSettingsDialog',
  ]) {
    assert.match(chrome, new RegExp(`<${member}`), member)
  }
  assert.match(menu, /!collegeAdmissionHudHidden[\s\S]{0,300}<GameMenuSkull/)
  assert.match(menu, /!collegeAdmissionHudHidden && \([\s\S]*<GameFullscreenButton \/>/)
  assert.match(hub, /data-gameplay-hud=\{gameplayHudHidden \? 'hidden' : 'visible'\}/)
  assert.match(hub, /gameplayHudHidden \? 'modal' : hubUiSurface\?\.kind/)
  assert.match(hub, /gameplayHudHidden[\s\S]*?onMenuAvailabilityChange\?\.\('hidden'\)/)
  assert.match(hub, /gameplayHudHidden[\s\S]*?event\.code !== settings\.controls\.openSkills/)
  assert.match(hub, /gameplayHudHidden[\s\S]*?event\.code !== settings\.controls\.openMenu/)
  assert.match(hub, /gameplayHudHiddenRef\.current[\s\S]*?cast: \{ primary: false, quickbar: null \}/)
  assert.match(hub, /setWorldSpeeches\([\s\S]*?gameplayHudHiddenRef\.current \? EMPTY_WORLD_SPEECHES : worldSpeechesRef\.current/)
  assert.match(hub, /setGameplayHudHidden\(gameplayHudHidden\)/)
  assert.match(hub, /gameplayHudHidden: gameplayHudHiddenRef\.current/)
  assert.match(hubRenderer, /renderable: !gameplayHudHidden/)
  assert.match(hubRenderer, /gameplayHudHidden \? \[\] : deriveHubPlayerActivityItems/)
  assert.match(inventory, /inventoryEnabled/)
  assert.match(css, /\[data-gameplay-hud='hidden'\][\s\S]*?\.hub-hud/)
  assert.match(css, /\[data-gameplay-hud='hidden'\][\s\S]*?\.hub-party-panel/)
  assert.match(css, /\[data-college-intro\][\s\S]*?\.game-touch-joystick/)
  assert.doesNotMatch(css, /(?:^|[,\s])\.touch-joystick\b/m)
})

test('renders exact stock UI records for the prelude and blinking lesson pointer', () => {
  const prelude = source('./TutorialPrelude.tsx')
  const overlay = source('./TutorialOverlay.tsx')
  const menu = source('./MainMenuScene.tsx')
  assert.match(prelude, /atlas="UI"[\s\S]*?className="tutorial-prelude-record"[\s\S]*?record=\{43\}/)
  assert.match(prelude, /className="tutorial-prelude-skull"[\s\S]*?record=\{68\}/)
  assert.match(prelude, /top: `calc\(50% - \$\{100 \* \(1 \+ blend\)\}px\)`/)
  assert.match(prelude, /maskTint=\{TUTORIAL_GOLD\}/)
  assert.match(overlay, /<NativeUiSprite atlas="UI" record=\{28\} \/>/)
  assert.match(overlay, /<NativeUiNineSlice[\s\S]*?atlas="UI"[\s\S]*?record=\{4\}/)
  assert.deepEqual(nativeUi.atlases.UI.records['28'], {
    frame: [202, 656, 58, 61], logicalSize: [58, 61], points: [], rotated: false, trimOrigin: [0, 0],
  })
  assert.deepEqual(nativeUi.atlases.UI.records['43'], {
    frame: [266, 62, 340, 66], logicalSize: [443, 171], points: [], rotated: false, trimOrigin: [50, 50],
  })
  assert.deepEqual(nativeUi.atlases.UI.records['68'], {
    frame: [753, 335, 93, 99], logicalSize: [93, 99], points: [], rotated: false, trimOrigin: [0, 0],
  })
  assert.deepEqual(nativeUi.atlases.UI.records['4'], {
    frame: [241, 720, 20, 20], logicalSize: [20, 20], points: [], rotated: false, trimOrigin: [0, 0],
  })
  assert.match(overlay, /const pointerBlink = useTutorialPointerBlink\(\)/)
  assert.match(overlay, /tutorialPointerVisible\(true, nativeApplicationTick\(now\)\)/)
  assert.match(overlay, /anchor="world-sack"[\s\S]*?visible=\{pointerBlink\}/)
  assert.match(overlay, /visible=\{pointer\.blink \? pointerBlink : true\}/)
  assert.doesNotMatch(overlay, /stageTicks % 50/)
  assert.match(overlay, /nativeTutorialHudPointerPlans\(state\.stage, hudAnchors\)/)
  assert.match(overlay, /scale=\{pointer\.scale\}/)
  assert.match(overlay, /data-pointer-scale=\{scale\}/)
  assert.match(overlay, /data-heading-baseline=\{instructionBaselines\?\.heading\}/)
  assert.match(overlay, /viewport\.height - 50/)
  assert.match(overlay, /durationTicks[\s\S]*?- state\.narration\.ticksRemaining[\s\S]*?\/ 100/)
  assert.match(menu, /screen === 'tutorial-prelude'[\s\S]*?\? 'boneyard'/)
})

test('guides the opening interaction and switches movement and casting copy by input surface', () => {
  const boneyard = source('./BoneyardScene.tsx')
  const overlay = source('./TutorialOverlay.tsx')
  assert.match(overlay, /const coarsePointer = useCoarsePointer\(\)/)
  for (const [label, binding] of [
    ['moveDown', 'controls.moveDown'],
    ['moveLeft', 'controls.moveLeft'],
    ['moveRight', 'controls.moveRight'],
    ['moveUp', 'controls.moveUp'],
  ]) {
    assert.match(
      overlay,
      new RegExp(`${label}: gameBindingLabel\\(${binding.replace('.', '\\\.')}\\)`),
    )
  }
  assert.match(overlay, /coarsePointer \? 'mobile' : 'desktop'/)
  assert.match(
    boneyard,
    /tutorialState\.stage <= 1[\s\S]*?encounter\?\.phase === 'digging'[\s\S]*?boneyardTutorialDigIndicatorLayout/,
  )
  assert.match(boneyard, /solomonPointer=\{tutorialSolomonPointer\}/)
  assert.match(overlay, /!state\.introActive[\s\S]*?solomonPointer[\s\S]*?anchor="solomon-dig"/)
  assert.match(overlay, /anchor="solomon-dig"[\s\S]*?visible=\{pointerBlink\}/)
  assert.match(boneyard, /data-tutorial-scene-paused=\{tutorialScenePaused\}/)
  const world = source('./core-server/boneyard-world.ts')
  assert.match(
    world,
    /nativeTutorialPlayerMovementPaused\(world\.tutorial\)[\s\S]*?velocity: \{ x: 0, y: 0 \}[\s\S]*?createIdlePlayerCharacterInput\(\)/,
  )
})

test('uses the stock MsgBox offer and common-gold teaching family', () => {
  const css = source('./tutorial.css')
  const overlay = source('./TutorialOverlay.tsx')
  const prompt = source('./title-menu-prompt.ts')
  const renderer = source('./renderer/title-menu-renderer.ts')
  assert.match(prompt, /title: 'PLAY THE TUTORIAL\?'/)
  assert.match(prompt, /Learn the controls and confront/)
  assert.match(prompt, /planNativeUiMessage/)
  assert.match(renderer, /nativeUi\.render\(planTitleMenuPrompt/)
  assert.match(overlay, /baseline=\{instructionBaselines!\.heading\}[\s\S]*?font="heading"/)
  assert.match(overlay, /const TUTORIAL_GOLD = 0xd9ba70/)
  assert.match(overlay, /centerX \+ 2\.25[\s\S]*calc\(\$\{centerX\} \+ 2\.25px\)/)
  assert.match(overlay, /tutorialModalTeachingPlans\(\{/)
  assert.match(overlay, /top: line\.y - frame\.y - glyphHalfHeight/)
  assert.doesNotMatch(overlay, /top: 11\.75|layoutNativeUiText/)
  assert.doesNotMatch(css, /tutorial-instruction[^{]*\{[^}]*drop-shadow/)
  assert.match(css, /\.tutorial-overlay\s*\{[^}]*width:\s*100%;[^}]*height:\s*100%;/s)
  assert.match(css, /\.tutorial-prelude\s*\{[^}]*width:\s*100%;[^}]*height:\s*100%;/s)
})

test('owns responsive Tutorial targets at the HUD controls instead of fixed coordinates', () => {
  const hud = source('./GameHud.tsx')
  const overlay = source('./TutorialOverlay.tsx')
  const quickbar = source('./SkillQuickbar.tsx')
  for (const anchor of ['health-meter', 'inventory', 'skills']) {
    assert.match(hud, new RegExp(`data-tutorial-anchor=[^\\n]*['"]${anchor}['"]`))
  }
  assert.match(
    quickbar,
    /data-tutorial-anchor=\{entry\?\.kind === 'health-potion'[\s\S]*?'health-potion'/,
  )
  assert.match(
    hud,
    /data-tutorial-anchor=\{binding === 12[\s\S]*?'primary-skill'[\s\S]*?binding === 16[\s\S]*?'concentration-a'/,
  )
  assert.match(hud, /className="hub-hud-backpack"[\s\S]*?data-tutorial-anchor="inventory"/)
  assert.match(hud, /className="hub-hud-tome"[\s\S]*?data-tutorial-anchor="skills"/)
  assert.doesNotMatch(hud, /className="hub-hud-backpack-button"[\s\S]{0,120}data-tutorial-anchor/)
  assert.match(quickbar, /slot === 0[\s\S]*?\? 'secondary-slot'/)
  assert.doesNotMatch(overlay, /state\.stage === 5 \? <TutorialPointer x=\{468\}/)
  assert.doesNotMatch(overlay, /state\.stage === 9 \? <TutorialPointer x=\{763\}/)
  assert.doesNotMatch(overlay, /state\.stage === 12 \? <TutorialPointer x=\{843\}/)
})

test('uses the same live potion bindings in the HUD and Tutorial without painting stack counts as keys', () => {
  const hud = source('./GameHud.tsx')
  const overlay = source('./TutorialOverlay.tsx')
  const quickbar = source('./SkillQuickbar.tsx')
  assert.match(quickbar, /bindingCode=\{controls\[`belt\$\{slot \+ 1\}` as GameBindingAction\]\}/)
  assert.match(quickbar, /const bindingLabel = gameBindingLabel\(bindingCode\)/)
  assert.match(quickbar, /entry\?\.kind === 'health-potion'/)
  assert.match(quickbar, /entry\?\.kind === 'mana-potion'/)
  assert.match(quickbar, /<NativeQuickbarBinding text=\{bindingLabel\.toUpperCase\(\)\} \/>/)
  assert.doesNotMatch(hud, /function InventoryCount/)
  assert.match(overlay, /potion: gameBindingLabel\(controls\.belt4\)/)
})

test('keeps the stage-17 Health Potion drop pointer-only until pickup notification', () => {
  const overlay = source('./TutorialOverlay.tsx')
  const stage17 = /\{\(state\.stage === 8 \|\| state\.stage === 17\)[^]*?\) : null\}/.exec(overlay)?.[0]
  assert.ok(stage17)
  assert.match(stage17, /anchor="world-sack"/)
  assert.doesNotMatch(stage17, /NativeBitmapText|Health Potion/)
})

test('keeps every recovered modal teaching literal in the modal callout model', () => {
  const model = source('./tutorial-modal-callouts.ts')
  const overlay = source('./TutorialOverlay.tsx')
  for (const literal of [
    'again to resume playing',
    'Put items here',
    'Put equippable items',
    'Found items go in your backpack',
    'Drag skills here',
    'You are CONCENTRATING on',
    'limited to one skill at a time',
    'skill icon for more information',
  ]) assert.match(model, new RegExp(literal))
  assert.match(overlay, /primary attack or concentration/)
  assert.match(overlay, /state\.stage === 8 \|\| state\.stage === 17/)
  assert.doesNotMatch(overlay, /Put items here|Drag skills here|again to resume playing/)
  assert.doesNotMatch(overlay, /equip (?:the )?Sorceror's Amulet/i)
  assert.doesNotMatch(model, /equip (?:the )?Sorceror's Amulet/i)
})

test('mounts modal callouts from the live Boneyard Tutorial owner', () => {
  const boneyard = source('./BoneyardScene.tsx')
  const menu = source('./MainMenuScene.tsx')
  assert.match(
    boneyard,
    /tutorial && \(tutorial\.stage === 10 \|\| tutorial\.stage === 13\)[\s\S]*?<TutorialModalCallouts[\s\S]*?backpack=\{economy\.backpack\}[\s\S]*?controls=\{settings\.controls\}[\s\S]*?progression=\{progression\}[\s\S]*?stage=\{tutorial\.stage\}[\s\S]*?\/>/,
  )
  assert.doesNotMatch(boneyard, /stageTicks=\{tutorial\.stageTicks\}/)
  assert.doesNotMatch(menu, /TutorialModalCallouts/)
})

test('shares each native modal slide with its Tutorial anchors and leaves at close start', () => {
  const inventory = source('./HubInventoryUi.tsx')
  const menu = source('./MainMenuScene.tsx')
  const overlay = source('./TutorialOverlay.tsx')
  const skillBook = source('./SkillBook.tsx')
  assert.match(inventory, /setNativeModalSlideProgress\('inventory', reveal\)/)
  assert.match(inventory, /useSyncExternalStore\([\s\S]*?nativeModalSlideProgressSnapshot/)
  assert.match(
    inventory,
    /const inventoryResumeProgress = surface\.kind === 'inventory' \? modalSlides\.inventory : 1[\s\S]*?nativeHudModalSlideLayout\([\s\S]*?inventoryResumeProgress[\s\S]*?\.backpack/,
  )
  assert.match(
    inventory,
    /<NativeAction[\s\S]*?data-inventory-resume[\s\S]*?gameBack[\s\S]*?onClick=\{onInventoryBack\}/,
  )
  assert.match(inventory, /const inventoryBackOrClose[\s\S]*?audio\.playSound\('open-panel'\)[\s\S]*?closeSurface\(\)/)
  assert.match(inventory, /surface\.kind !== 'inventory'[\s\S]*?Close \{label\}/)
  assert.match(skillBook, /setNativeModalSlideProgress\('skills', progress\)/)
  assert.match(
    skillBook,
    /nativeHudModalSlideLayout\([\s\S]*?openProgress[\s\S]*?\.tome/,
  )
  assert.match(
    skillBook,
    /className="skill-book-close-action"[\s\S]*?data-skill-book-resume="true"[\s\S]*?data-game-back="true"[\s\S]*?style=/,
  )
  assert.match(overlay, /useSyncExternalStore\([\s\S]*?nativeModalSlideProgressSnapshot/)
  assert.match(overlay, /modalProgress: modalProgress|modalProgress,/)
  assert.match(
    menu,
    /onCloseStart=\{\(\) => \{[\s\S]*?sendTutorialAction\('skills-closed'\)/,
  )
})

test('keeps the Tutorial camera full while any living enemy is outside the future target', () => {
  const simulation = source('./core-server/game-simulation.ts')
  const tutorial = source('./core-kernels/native-tutorial.ts')
  const world = source('./core-server/boneyard-world.ts')
  assert.match(
    simulation,
    /nativeTutorialCameraLockSafetyClear\([\s\S]*?enemies\.actors[\s\S]*?enemies\.maggots[\s\S]*?loot\.actors/,
  )
  assert.match(simulation, /loot\.actors\.filter\(\(\{ kind \}\) => kind === 'sack'\)/)
  assert.match(tutorial, /cameraLockSafetyClear[\s\S]*?cameraLockTriggered: false/)
  assert.match(
    world,
    /cameraLockTriggered[\s\S]*?nativeTutorialEnemyCameraPositionIsAllowed/,
  )
})

test('owns the stage-14 acknowledgement edge and live selected-HUD geometry', () => {
  const overlay = source('./TutorialOverlay.tsx')
  const scene = source('./MainMenuScene.tsx')
  const css = source('./tutorial.css')
  assert.match(
    overlay,
    /state\.stage === 14[\s\S]*!state\.selectedSkillHudAcknowledged[\s\S]*selectedHudLayout/,
  )
  assert.match(overlay, /nativeTutorialSelectedHudLayoutFromCenters/)
  assert.doesNotMatch(overlay, /readonly selectedHudLayout: NativeTutorialSelectedHudLayout/)
  assert.match(overlay, /baseline=\{selectedHudLayout\.firstLine\.y\}/)
  assert.match(overlay, /baseline=\{selectedHudLayout\.secondLine\.y\}/)
  assert.match(
    overlay,
    /<TutorialPointer anchor="selected-skills" \{\.\.\.selectedHudLayout\.pointer\} visible=\{pointerBlink\} \/>/,
  )
  assert.doesNotMatch(overlay, /state\.stage === 14[\s\S]{0,300}<TutorialPointer x=\{800\}/)
  assert.match(
    scene,
    /binding === 12[\s\S]*sendTutorialAction\('primary-selector-opened'\)/,
  )
  assert.match(
    scene,
    /binding === 16[\s\S]*sendTutorialAction\('concentration-a-selector-opened'\)/,
  )
  assert.doesNotMatch(css, /tutorial-callout-primary/)
  assert.doesNotMatch(css, /tutorial-callout-(?:resume|quick-use|equipment|backpack|concentration|hover)/)
  assert.doesNotMatch(css, /\.tutorial-callout \{[^}]*overflow/)
})

import accountFlourish from '../assets/game/dark-cloud/account-flourish.png'
import cornerGold from '../assets/game/dark-cloud/corner-gold.png'
import flourish from '../assets/game/dark-cloud/flourish.png'
import skull from '../assets/game/dark-cloud/skull.png'

interface DarkCloudPanelOrnamentsProps {
  /** Skull-and-vine crest riding the top edge (the native in-cloud menu). */
  crest?: boolean
  /** Pentagram-skull flourishes outside the left/right frame lines. */
  flourishes?: boolean
}

/**
 * Dressing shared by every framed Dark Cloud panel (menu, search, sort, mod
 * details): the native dialog's gold filigree corners, its side flourishes and,
 * for the menu, the crest. Purely decorative, so every image is alt="".
 */
export default function DarkCloudPanelOrnaments({
  crest = false,
  flourishes = true,
}: DarkCloudPanelOrnamentsProps) {
  return (
    <>
      <img className="dark-cloud-panel-corner top-left" src={cornerGold} alt="" />
      <img className="dark-cloud-panel-corner top-right" src={cornerGold} alt="" />
      <img className="dark-cloud-panel-corner bottom-left" src={cornerGold} alt="" />
      <img className="dark-cloud-panel-corner bottom-right" src={cornerGold} alt="" />
      {flourishes ? (
        <>
          <img className="dark-cloud-panel-flourish left" src={accountFlourish} alt="" />
          <img className="dark-cloud-panel-flourish right" src={accountFlourish} alt="" />
        </>
      ) : null}
      {crest ? (
        <span className="dark-cloud-panel-crest" aria-hidden>
          <img src={flourish} alt="" />
          <img src={skull} alt="" />
          <img className="mirrored" src={flourish} alt="" />
        </span>
      ) : null}
    </>
  )
}

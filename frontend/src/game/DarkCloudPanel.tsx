import accountFlourish from '../assets/game/dark-cloud/account-flourish.png'
import cornerGold from '../assets/game/dark-cloud/corner-gold.png'

interface DarkCloudPanelOrnamentsProps {
  /** Pentagram-skull flourishes outside the left/right frame lines. */
  flourishes?: boolean
}

/**
 * Dressing shared by every framed Dark Cloud panel (search, sort, mod details):
 * the native dialog's gold filigree corners and its side flourishes. Purely
 * decorative, so every image is alt="".
 */
export default function DarkCloudPanelOrnaments({
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
    </>
  )
}

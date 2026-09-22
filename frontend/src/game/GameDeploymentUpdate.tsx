import './game-deployment-update.css'

interface GameDeploymentUpdateProps {
  saved: boolean
  reloadRequired?: boolean
}

export default function GameDeploymentUpdate({ saved, reloadRequired = false }: GameDeploymentUpdateProps) {
  return (
    <div className="game-deployment-update" role="status" aria-live="assertive">
      <section className="game-deployment-update-panel">
        <p className="game-deployment-update-kicker">Server update</p>
        <h1>Game updating</h1>
        <p>
          {reloadRequired
            ? 'The updated game could not be opened automatically. Reload the page to try again.'
            : saved
            ? 'Your game is saved. Solomon Dark will restart automatically when the update is ready.'
            : 'Saving your game before the update. Solomon Dark will restart automatically.'}
        </p>
        {reloadRequired && <button className="btn btn-gold" onClick={() => window.location.reload()}>Reload page</button>}
      </section>
    </div>
  )
}

interface ContextualInteractButtonProps {
  readonly label: string
  readonly onInteract: () => void
  readonly target: string
}

export default function ContextualInteractButton({
  label,
  onInteract,
  target,
}: ContextualInteractButtonProps) {
  return (
    <button
      type="button"
      className="game-interact-prompt"
      data-interaction-target={target}
      aria-label={label}
      onClick={onInteract}
    >
      <span className="game-interact-key" aria-hidden>E</span>
      <span className="game-interact-action" aria-hidden>INTERACT</span>
      <span className="game-interact-label" aria-hidden>{label}</span>
    </button>
  )
}

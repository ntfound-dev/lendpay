interface ScoreRingProps {
  score: number
  subtitle: string
}

export function ScoreRing({ score, subtitle }: ScoreRingProps) {
  const normalized = Math.max(0, Math.min(score, 1000))
  const radius = 96
  const circumference = 2 * Math.PI * radius
  const progress = circumference - (normalized / 1000) * circumference

  return (
    <div className="score-ring">
      <svg viewBox="0 0 240 240" role="img" aria-label={`Credit score ${score}`}>
        <defs>
          <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#58a6ff" />
            <stop offset="50%" stopColor="#2dd4bf" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
        <circle cx="120" cy="120" r={radius} className="score-ring__track" />
        <circle
          cx="120"
          cy="120"
          r={radius}
          className="score-ring__progress"
          strokeDasharray={circumference}
          strokeDashoffset={progress}
        />
      </svg>
      <div className="score-ring__content">
        <strong>{score}</strong>
        <span>{subtitle}</span>
      </div>
    </div>
  )
}

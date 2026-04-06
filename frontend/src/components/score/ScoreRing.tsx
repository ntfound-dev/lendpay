interface ScoreRingProps {
  score: number
}

const scoreColor = (score: number) => {
  if (score < 500) return '#dc2626'
  if (score < 650) return '#d97706'
  if (score < 750) return '#1a6cf5'
  return '#16a34a'
}

export function ScoreRing({ score }: ScoreRingProps) {
  const normalized = Math.max(0, Math.min(score, 1000))
  const radius = 130
  const circumference = 2 * Math.PI * radius
  const progress = circumference - (normalized / 1000) * circumference
  const stroke = scoreColor(score)

  return (
    <div className="score-ring">
      <svg viewBox="0 0 320 320" role="img" aria-label={`Credit score ${score}`}>
        <circle cx="160" cy="160" r={radius} className="score-ring__track" />
        <circle
          cx="160"
          cy="160"
          r={radius}
          className="score-ring__progress"
          style={{ stroke }}
          strokeDasharray={circumference}
          strokeDashoffset={progress}
        />
      </svg>
      <div className="score-ring__content">
        <strong>{score}</strong>
      </div>
    </div>
  )
}

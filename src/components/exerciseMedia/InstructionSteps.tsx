/** Ordered how-to steps from the exercise library. */
export function InstructionSteps({ steps }: { steps: string[] }) {
  if (steps.length === 0) {
    return null
  }
  return (
    <section className="example__how">
      <h3 className="type-eyebrow example__how-title">How to</h3>
      <ol className="example__steps">
        {steps.map((step) => (
          <li key={step} className="example__step">
            {step}
          </li>
        ))}
      </ol>
    </section>
  )
}

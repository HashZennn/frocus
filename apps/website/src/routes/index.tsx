import { VoiceButton } from '#/components/voiceButton.tsx';
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <div>
      Frocus
      <br />
      <VoiceButton />
    </div>
  )
}

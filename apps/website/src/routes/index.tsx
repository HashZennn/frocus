import { VoiceButton } from '#/components/voiceButton.tsx';
import { createExecutor, executeAll } from '#/core/executor.ts';
import type { VoiceCommandContext } from '#/types/voice.ts';
import { createFileRoute, useLocation, useNavigate } from '@tanstack/react-router'
import { z } from 'zod';

export const Route = createFileRoute('/')({ component: Home })

const voiceContext: VoiceCommandContext = {
  language: "ne",
  routes: [
    { path: "/", name: "Landing" },
    { path: "/download", name: "Download" }
  ],
  actions: {
    current_route: z.object({}).describe("Log the current route")
  }
}

function Home() {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const executor = createExecutor({
    navigate: (path) => navigate({ to: path }),
    forms: {
    },
    actions: {
      current_route: () => console.log("Current route is: ", pathname)
    }
  })

  return (
    <div>
      Frocus
      <br />
      <VoiceButton context={voiceContext} onCommand={async (result) => await executeAll(result.command, executor)} />
    </div>
  )
}

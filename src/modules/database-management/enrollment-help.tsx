import type { enrollmentGuidance } from "./enrollment-guidance";

export function EnrollmentHelp({ guidance }: { guidance: ReturnType<typeof enrollmentGuidance> }) {
  return <details className="rounded-2xl border border-slate-300 p-3 text-sm dark:border-slate-600">
    <summary className="cursor-pointer font-medium">Find your one-time enrollment token</summary>
    <div className="mt-3 space-y-3">
      <p>On the machine running IT Assets, read <code className="break-all">{guidance.tokenPath}</code>.</p>
      <p>{guidance.shell}:</p>
      <pre className="whitespace-pre-wrap break-all rounded-lg bg-black/5 p-3 dark:bg-black/20"><code>{guidance.localCommand}</code></pre>
      <p>For this repository’s managed Docker Compose file, run on the Docker host:</p>
      <pre className="whitespace-pre-wrap break-all rounded-lg bg-black/5 p-3 dark:bg-black/20"><code>{guidance.dockerCommand}</code></pre>
      <p>Use your deployed Compose file and app service name if different. The command reads the container’s configured control directory. Paste the token only into this form; enrollment consumes it once.</p>
    </div>
  </details>;
}

/* This file is generated from the canonical JSON Schema. Do not edit it manually. */

export interface Job {
contractVersion: "v1"
id: string
pipelineId: string
runId: string
stepId: string
componentId: string
state: ("queued" | "running" | "succeeded" | "failed" | "cancelled")
attempt: number
retryPolicy: {
maxAttempts: number
retryDelaySeconds: number
}
availableAt: string
claim?: {
workerId: string
claimedAt: string
heartbeatAt: string
}
cancellation?: {
requestedAt: string
requestedByUserId?: string
}
completedAt?: string
}

/* This file is generated from the canonical JSON Schema. Do not edit it manually. */

export interface Run {
contractVersion: "v1"
id: string
pipelineId: string
state: ("queued" | "running" | "succeeded" | "completed_with_warnings" | "failed" | "cancelled")
createdAt: string
startedAt?: string
completedAt?: string
cancellationRequestedAt?: string
warningCount: number
steps: {
stepId: string
componentId: string
state: ("queued" | "running" | "succeeded" | "completed_with_warnings" | "failed" | "cancelled")
startedAt?: string
completedAt?: string
warningCount: number
metrics: {
recordsRead?: number
recordsWritten?: number
bytesRead?: number
bytesWritten?: number
durationMilliseconds?: number
}
error?: {
code: string
message: string
field?: string
rowIndex?: number
}
}[]
}

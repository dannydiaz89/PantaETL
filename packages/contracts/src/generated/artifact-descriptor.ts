/* This file is generated from the canonical JSON Schema. Do not edit it manually. */

export interface ArtifactDescriptor {
contractVersion: "v1"
id: string
pipelineId: string
runId: string
format: string
contentType?: string
fileName: string
sizeBytes: number
storage: {
kind: ("local" | "s3")
location: string
encrypted: boolean
}
createdAt: string
retention: {
expiresAt: string
retentionDays: number
}
}

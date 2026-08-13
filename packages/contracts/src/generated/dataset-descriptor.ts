/* This file is generated from the canonical JSON Schema. Do not edit it manually. */

export interface DatasetDescriptor {
contractVersion: "v1"
id: string
family: ("any" | "document" | "tabular" | "file")
format: string
storage: {
kind: ("local" | "s3")
location: string
encrypted: boolean
}
structure?: {
format: string
fields?: {
name: string
type: string
nullable?: boolean
}[]
metadata?: {
[k: string]: unknown
}
}
pipelineId: string
runId: string
stepId: string
createdAt: string
expiresAt: string
}

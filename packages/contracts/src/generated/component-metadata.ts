/* This file is generated from the canonical JSON Schema. Do not edit it manually. */

export interface ComponentMetadata {
kind: ("source" | "transform" | "export")
type: string
version: string
displayNameKey: string
descriptionKey: string
configFields: {
key: string
type: ("text" | "textarea" | "number" | "boolean" | "select" | "json")
labelKey: string
descriptionKey?: string
required: boolean
secret: boolean
options?: {
value: string
labelKey: string
}[]
}[]
inputFamilies: ("any" | "document" | "tabular" | "file")[]
outputFamilies: ("any" | "document" | "tabular" | "file")[]
}

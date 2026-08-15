/* This file is generated from the canonical JSON Schema. Do not edit it manually. */

export interface ComponentMetadata {
kind: ("source" | "transform" | "export")
type: string
version: string
displayNameKey: string
descriptionKey: string
configFields: {
key: string
type: ("text" | "textarea" | "number" | "boolean" | "select" | "json" | "file")
labelKey: string
descriptionKey?: string
placeholderKey?: string
required: boolean
secret: boolean
width?: ("short" | "medium" | "full")
defaultValue?: (string | number | boolean)
options?: {
value: string
labelKey: string
}[]
}[]
inputFamilies: ("any" | "document" | "tabular" | "file")[]
outputFamilies: ("any" | "document" | "tabular" | "file")[]
}

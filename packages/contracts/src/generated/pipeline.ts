/* This file is generated from the canonical JSON Schema. Do not edit it manually. */

/**
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^(?!(?:.*(?:[Aa][Pp][Ii][_\-]?[Kk][Ee][Yy]|[Aa][Uu][Tt][Hh][Oo][Rr][Ii][Zz][Aa][Tt][Ii][Oo][Nn]|[Cc][Rr][Ee][Dd][Ee][Nn][Tt][Ii][Aa][Ll]|[Pp][Aa][Ss][Ss][Ww][Oo][Rr][Dd]|[Ss][Ee][Cc][Rr][Ee][Tt]|[Tt][Oo][Kk][Ee][Nn]))).+$".
 */
export type NonSecretJsonValue = (string | number | boolean | null | NonSecretJsonValue[] | {
[k: string]: NonSecretJsonValue
})

export interface Pipeline {
contractVersion: "v1"
id: string
ownerUserId: string
name: string
state: ("draft" | "enabled" | "disabled")
createdAt: string
updatedAt: string
/**
 * @minItems 1
 */
steps: [{
id: string
kind: ("source" | "transform" | "export")
componentType: string
componentVersion: string
configuration: {
values: {
[k: string]: NonSecretJsonValue
}
secretBindings: {
key: string
binding: string
}[]
}
}, ...({
id: string
kind: ("source" | "transform" | "export")
componentType: string
componentVersion: string
configuration: {
values: {
[k: string]: NonSecretJsonValue
}
secretBindings: {
key: string
binding: string
}[]
}
})[]]
edges: {
fromStepId: string
toStepId: string
}[]
triggers: ({
id: string
pipelineId: string
type: "manual"
enabled: boolean
} | {
id: string
pipelineId: string
type: "schedule"
enabled: boolean
cron: string
timezone: string
})[]
}

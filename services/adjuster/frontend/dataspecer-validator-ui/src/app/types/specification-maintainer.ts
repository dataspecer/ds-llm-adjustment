export type FlowStep = 'select-specification' | 'upload-schema' | 'change-summary'

export interface SelectedSpecification {
  id: string
  name: string
  psm: {
    id: string
    name: string
    iri: string
  }
}

export interface ChangeDecision {
  changeId: string
  decision: 'accept' | 'reject' | 'developer'
  comment?: string
} 
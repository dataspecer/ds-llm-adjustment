// Simple typed accessor for prompts JSON with robust fallback

export interface ChangesDetectorPromptsConfig {
  jsonDiffTemplate: string;
  fallbackTemplate: string;
}

export interface ChangesSuggesterPromptsConfig {
  suggestionsTemplate: string;
}

export interface SpecificationProcessorPromptsConfig {
  describeChangesTemplate: string;
  schemaDifferencesTemplate: string;
  definitionsTemplate: string;
}

export interface PromptsConfig {
  changesDetector: ChangesDetectorPromptsConfig;
  changesSuggester: ChangesSuggesterPromptsConfig;
  specificationProcessor: SpecificationProcessorPromptsConfig;
}

const defaultPrompts: PromptsConfig = {
  changesDetector: {
    jsonDiffTemplate:
      "You are a data model expert who tries to control how the data are used in JSON Schemas regarding vocabularies (for example OWL). Analyze JSON  differences and categorize changes.\n\nIMPORTANT: Provide a valid, complete JSON response. Limit your analysis to the most significant changes if there are many.\n\nTask:\n1. Categorize each difference: addition, removal, rename, type-change\n2. Assess PSM compliance for each change - there is some vocabulary behind PSM, which describes the data model of the API with usage of OWL, LOD etc.\n\nFor each change provide (ALL FIELDS MUST BE PRESENT):\n- changeId: unique string identifier\n- type: array of change types\n- path: JSONPath to element\n- description: brief explanation\n- isAcceptable: boolean for PSM compliance\n- groupId: string or null (use null if no grouping)\n\nDifferences:\n{differences}\n\nPSM Schema:\n{psm}\n\nReturn only valid JSON with the changes array.",
    fallbackTemplate:
      "Analyze API specifications to identify differences.\n\nIMPORTANT: Provide a valid, complete JSON response. Limit analysis to significant changes only.\n\nTask:\n1. Find differences between old and new API\n2. Categorize: addition, removal, rename, type-change  \n3. Assess PSM compliance\n\nFor each change (ALL FIELDS MUST BE PRESENT):\n- changeId: unique identifier\n- type: array of change types\n- path: JSONPath to changed element\n- description: brief explanation\n- isAcceptable: boolean for PSM compliance\n- groupId: string or null (use null if no grouping)\n\nAPI Data:\n{differences}\n\nPSM Schema:\n{psm}\n\nReturn only valid JSON with changes array.",
  },
  changesSuggester: {
    suggestionsTemplate:
      "You are provided with a list of changes detected in an API specification and a PSM context (selected relevant chunks).\nChanges (JSON): {changes}\nPSM context: {psm}\n\nFor each change, provide:\n- A suggestion for how to handle the change\n- A rationale explaining why this suggestion is appropriate\n\nConstraints:\n- Keep responses concise and actionable\n- Assume the PSM text may be truncated; do not rely on missing context\n\nConsider:\n1. Impact on existing systems\n2. Backward compatibility\n3. Best practices for API design",
  },
  specificationProcessor: {
    describeChangesTemplate:
      "Describe the changes made to the artifact. \nOriginal: {original} \nUpdated: {updated}",
    schemaDifferencesTemplate:
      "You are provided with two JSON schemas.\n      Old JSON schema: {oldSchema}\n      New JSON schema: {newSchema}\n      PSM Artifact: {psm}\n\n      Your task is to compare the two schemas and identify the changes between them. There may be alternatives - mark them via \n      alternativeChangeId, for example - addedProperties in combination with removedProperties vs. changedProperties, \n      you do not know for sure if it is a complitley new property or just renaming. Also take into account relatedChangeId - \n      an array of changeId, for example if a new class added, addedClasses will contain chnageId's of \n      related addedProperties and vice-versa. Describe the changes in a human-readable format.\n      Return a JSON object with array of following properties:\n\n      \"addedProperties\",\n      \"removedProperties\",\n      \"changedProperties\",\n      \"addedClasses\",\n      \"addedConnections\",\n      \"removedConnections\",\n      \"removedClasses\",\n      \"changesDescription\"",
    definitionsTemplate:
      "You are provided with a PSM artifact and two API specifications.\n      PSM Artifact: {psm}\n      Old API: {oldApi}\n      New API: {newApi}\n      Action: {action}\n      Artifact Format: {artifactFormat}\n\n      Your task is to analyze the changes between the old and new API specifications and provide a detailed description of the changes.\n      Focus on identifying:\n      1. Added properties, classes, and connections\n      2. Removed properties, classes, and connections\n      3. Changed properties and their types\n      4. Any structural changes in the API\n\n      Provide a clear and concise description of all changes.",
  },
};

let loadedPrompts: PromptsConfig | undefined;
try {
  // Use eval to avoid webpack static analysis issues with JSON assets
  const json = eval('require')( './prompts.json');
  loadedPrompts = json as PromptsConfig;
} catch (_e) {
  loadedPrompts = undefined;
}

export const PROMPTS: PromptsConfig = loadedPrompts || defaultPrompts;



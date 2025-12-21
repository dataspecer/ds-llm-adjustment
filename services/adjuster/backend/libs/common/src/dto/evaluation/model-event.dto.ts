export interface ModelSelectionEventDto {
  runId: string;
  service: 'changes-detector' | 'changes-suggester' | 'dialogs-handler' | 'specification-processor' | 'llm-chat' | 'dataspecer-adapter';
  operation: string; // e.g., detect, suggest, process, chat
  modelName: 'gpt-5' | 'gpt-5-mini' | 'gpt-5-nano' | 'gpt-oss-120b';
  timestamp?: string;
}





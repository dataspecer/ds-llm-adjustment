# LLM Chat Setup Guide

## Overview

The LLM Chat functionality allows specification maintainers to have AI-powered conversations about schema changes. The system uses OpenAI's GPT models to provide expert analysis and recommendations.

## Prerequisites

1. **OpenAI API Key**: You need an OpenAI API account and key
2. **LangChain Dependencies**: Already included in package.json

## Environment Setup

Create a `.env` file in the backend root directory with:

```bash
# Required for LLM Chat
OPENAI_API_KEY=your_openai_api_key_here

# Database (existing)
DATABASE_URL=postgresql://adjuster:adjuster123@postgres:5432/adjuster

# Application Configuration
NODE_ENV=development
PORT=3101
```

## How It Works

### Backend Architecture

1. **LlmChatService** (`/services/specification-maintainer/llm-chat.service.ts`)
   - Manages chat conversations
   - Integrates with OpenAI via LangChain
   - Builds context-aware prompts
   - Handles conversation history

2. **API Endpoints** (added to SpecificationMaintainerController)
   - `POST /chat/start` - Start new conversation
   - `POST /chat/message` - Send message to conversation
   - `GET /chat/:conversationId` - Get conversation
   - `POST /chat/by-changes` - Get conversations for specific changes
   - `POST /chat/:conversationId/delete` - Delete conversation

### Frontend Integration

1. **LlmChat Component** (`/components/LlmChat.tsx`)
   - Modal-based chat interface
   - Auto-scrolling message history
   - Keyboard shortcuts (Enter to send, Shift+Enter for new line)
   - Loading states and error handling

2. **Integration Points**
   - **ChangeSummary**: Chat button for all changes + individual change chat
   - **SpecificationMaintainer**: Chat button in nav + chat for selected change

## Usage

### Starting a Chat

1. **All Changes**: Click "💬 Chat about All Changes" to discuss all detected changes
2. **Individual Change**: Select a change and click "💬 Chat" to discuss that specific change
3. **Custom Prompt**: The system automatically generates contextual prompts, but users can customize

### Chat Features

- **Context-Aware**: AI knows about all change details (type, path, description, acceptability)
- **Conversational**: Ask follow-up questions, request clarifications, discuss alternatives
- **Expert Analysis**: Get insights on breaking changes, migration strategies, best practices
- **Change References**: AI can reference specific changes by ID

### Example Conversations

**Maintainer**: "What are the risks of these changes?"

**AI**: "Looking at your 4 changes, I see 1 potentially problematic removal (change-2: username property). The main risks are:

1. **Breaking Change**: Removing the username property could break client applications that depend on it for user identification.
2. **Data Loss**: Existing username data might be lost if not properly migrated.
3. **Authentication Impact**: If username is used for login, this could break authentication flows.

Recommendations:
- Consider deprecating username instead of removing it immediately
- Provide migration guide for clients
- Ensure alternative identification methods are in place

The other changes (email addition, price type change, orderDate rename) are lower risk and mostly backward-compatible."

**Maintainer**: "How should I handle the username removal?"

**AI**: "For the username removal (change-2), I recommend a phased approach:

1. **Phase 1 - Deprecation**:
   - Mark username as deprecated in documentation
   - Add warning headers in API responses
   - Ensure email field is available as alternative

2. **Phase 2 - Transition Period**:
   - Support both username and email for identification
   - Provide clear migration timeline (e.g., 6 months)
   - Send notifications to API consumers

3. **Phase 3 - Removal**:
   - Remove username field only after confirming no active usage
   - Monitor error rates during rollout

This approach minimizes disruption while maintaining data integrity."

## Configuration Options

### LangChain Model Settings

```typescript
this.llm = new ChatOpenAI({
  modelName: 'gpt-4o-mini', // Cost-effective for chat
  temperature: 0.7,         // Balance creativity/consistency
  openAIApiKey: process.env.OPENAI_API_KEY,
});
```

### Conversation Management

- **Message History**: Keeps last 10 messages for context
- **Memory**: In-memory storage (production should use database)
- **System Prompts**: Specialized for schema evolution expertise

## Troubleshooting

### Common Issues

1. **"Failed to start chat conversation"**
   - Check OpenAI API key is set
   - Verify API key has sufficient credits
   - Check network connectivity

2. **AI responses seem generic**
   - Ensure change data is properly passed
   - Check system prompt is building correctly
   - Verify context is maintained in conversation

3. **Performance issues**
   - Monitor OpenAI API usage and costs
   - Consider using faster models for simple questions
   - Implement response caching if needed

## Future Enhancements

- **Persistent Storage**: Save conversations to database
- **Multiple Models**: Support different LLM providers
- **Template Prompts**: Pre-built prompts for common scenarios
- **Integration**: Link chat insights back to change decisions
- **Analytics**: Track conversation patterns and effectiveness 
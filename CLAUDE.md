# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a LangGraph course repository demonstrating various concepts including:
- Basic state graphs with annotations and reducers
- Agent workflows with tool calling
- RAG (Retrieval-Augmented Generation) basics
- Memory management with checkpointers

## Development Commands

### Package Management
- `pnpm install` - Install dependencies
- `pnpm start` - Run the main RAG basics example

### Code Quality
- `npx biome format .` - Format code using Biome
- `npx biome lint .` - Lint code using Biome
- `npx biome check .` - Run both formatting and linting
- `npx biome ci` - Run checks for CI (formatter + linter + import sorting)

### Testing
- `npx vitest` - Run tests
- `npx vitest watch` - Run tests in watch mode
- `npx vitest run` - Run tests once

### Build
- `npx tsup` - Build the project using tsup

### Type Checking
- `npx tsc --noEmit` - Type check without emitting files

## Architecture

### Core Technologies
- **LangGraph**: State graph framework for building agent workflows
- **LangChain**: LLM application framework with OpenAI integration
- **TypeScript**: Main language with strict typing enabled
- **Biome**: Code formatter and linter
- **Vitest**: Testing framework
- **pnpm**: Package manager

### State Management Pattern
The codebase uses LangGraph's `Annotation.Root` pattern for state definitions with custom reducers:
- String concatenation: `reducer: (cur, upd) => cur + upd`
- Array concatenation: `reducer: (cur, upd) => cur.concat(upd)`
- Numeric addition: `reducer: (cur, upd) => cur + upd`

### Key Files
- `src/basic.ts` - Basic state graph example with conditional routing
- `src/agent-basics.ts` - Agent workflow with tool calling and memory
- `src/tool-calling.ts` - Tool integration examples
- `src/RAG-basics.ts` - RAG implementation (current main entry point)
- `src/utils/render-graph.ts` - Graph visualization utilities

### Configuration
- Uses path aliases: `@/*` maps to `src/*`
- Environment variables loaded via `dotenv/config`
- TypeScript target: ESNext with Node module resolution
- Biome configured with 120 character line width
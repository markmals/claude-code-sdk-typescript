# Claude Code SDK for TypeScript

TypeScript SDK for Claude Code built for Node.js 22+.

## Installation

```bash
npm install claude-code-sdk-typescript
```

## Usage

```ts
import { query } from 'claude-code-sdk-typescript'

for await (const message of query('What is 2 + 2?')) {
  console.log(message)
}
```

The `QueryEventTarget` class provides an event-driven API:

```ts
const target = new QueryEventTarget('hello')
target.addEventListener('message', e => console.log(e.data))
```

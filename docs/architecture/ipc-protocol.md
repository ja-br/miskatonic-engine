# IPC Protocol

## Overview

The IPC (Inter-Process Communication) protocol enables type-safe communication between the main and renderer processes.

## Architecture

### Channel Handlers

All IPC operations are handled by channel handlers that extend `BaseChannelHandler`:

```typescript
export class FileReadHandler extends BaseChannelHandler<FileReadRequest, FileReadResponse> {
  channel = IPC_CHANNELS.FILE_READ;
  requestSchema = FileReadRequestSchema;
  responseSchema = FileReadResponseSchema;

  async handle(event: IpcMainInvokeEvent, request: FileReadRequest): Promise<FileReadResponse> {
    // Implementation
  }
}
```

### Type Safety

1. **Request Validation**: Zod schema validates incoming data
2. **Handler Execution**: Type-safe handler processes request
3. **Response Validation**: Zod schema validates outgoing data
4. **TypeScript Types**: Full type inference in renderer

### Adding a New IPC Channel

1. **Define Types** (`packages/shared/src/types/ipc.ts`):
```typescript
export const MyRequestSchema = z.object({
  data: z.string(),
});
export type MyRequest = z.infer<typeof MyRequestSchema>;
```

2. **Add Channel Constant** (`packages/shared/src/constants/channels.ts`):
```typescript
export const IPC_CHANNELS = {
  MY_CHANNEL: 'my:channel',
  // ...
};
```

3. **Create Handler** (`packages/main/src/ipc/channels/MyChannel.ts`):
```typescript
export class MyHandler extends BaseChannelHandler<MyRequest, MyResponse> {
  channel = IPC_CHANNELS.MY_CHANNEL;
  requestSchema = MyRequestSchema;
  responseSchema = MyResponseSchema;

  async handle(event, request) {
    // Implementation
  }
}
```

4. **Register Handler** (`packages/main/src/ipc/IPCHandler.ts`):
```typescript
const allHandlers = [
  new MyHandler(),
  // ...
];
```

5. **Add API Method** (`packages/preload/src/api/MyAPI.ts`):
```typescript
export function createMyAPI() {
  return {
    myMethod: (data: string) => {
      return ipcRenderer.invoke(IPC_CHANNELS.MY_CHANNEL, { data });
    },
  };
}
```

6. **Use in Renderer**:
```typescript
const result = await window.electronAPI.my.myMethod('data');
```

## Available Channels

### File Operations

- `file:read` - Read file from userData directory
- `file:write` - Write file to userData directory

### Window Operations

- `window:minimize` - Minimize window
- `window:maximize` - Maximize/unmaximize window
- `window:close` - Close window

### System Operations

- `system:info` - Get system information
- `system:gpu-info` - Get GPU/WebGL information
- `system:open-devtools` - Open Chrome DevTools

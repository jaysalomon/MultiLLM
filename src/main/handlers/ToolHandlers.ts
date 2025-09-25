import { ipcMain } from 'electron';
import type { ToolCall } from '../../types/chat';
import type { Tool } from '../../types/providers';
import { toolExecutor } from '../../tools/ToolExecutor';
import { toolRegistry } from '../../tools/ToolRegistry';
import type { KnowledgeBase } from '../../services/KnowledgeBase';
import { logger } from '../../utils/Logger';

export class ToolHandlers {
  private registered = false;

  constructor(initialKnowledgeBase?: KnowledgeBase) {
    if (initialKnowledgeBase) {
      this.attachKnowledgeBase(initialKnowledgeBase);
    }
  }

  attachKnowledgeBase(knowledgeBase: KnowledgeBase): void {
    try {
      toolExecutor.setKnowledgeBase(knowledgeBase);
      logger.info('[ToolHandlers] Knowledge base attached to tool executor');
    } catch (error) {
      logger.error('[ToolHandlers] Failed to attach knowledge base', { error });
    }
  }

  initialize(): void {
    if (this.registered) {
      return;
    }

    ipcMain.handle('tools:getRegistered', async (): Promise<Tool[]> => {
      try {
        return toolRegistry.getAll();
      } catch (error) {
        logger.error('[ToolHandlers] Failed to list tools', { error });
        return [];
      }
    });

    ipcMain.handle('tools:execute', async (_event, toolCall: ToolCall): Promise<string> => {
      try {
        return await toolExecutor.execute(toolCall);
      } catch (error) {
        logger.error('[ToolHandlers] Tool execution failed', { error, toolCall });
        const message = error instanceof Error ? error.message : 'Unknown error';
        return JSON.stringify({ error: message });
      }
    });

    ipcMain.handle('tools:executeBatch', async (_event, toolCalls: ToolCall[]): Promise<Record<string, string>> => {
      try {
        const results = await toolExecutor.executeBatch(toolCalls);
        const aggregated: Record<string, string> = {};
        for (const [id, result] of results.entries()) {
          aggregated[id] = result;
        }
        return aggregated;
      } catch (error) {
        logger.error('[ToolHandlers] Batch tool execution failed', { error, count: toolCalls?.length });
        return {};
      }
    });

    this.registered = true;
    logger.info('[ToolHandlers] IPC handlers registered');
  }

  dispose(): void {
    if (!this.registered) {
      return;
    }

    ipcMain.removeHandler('tools:getRegistered');
    ipcMain.removeHandler('tools:execute');
    ipcMain.removeHandler('tools:executeBatch');
    this.registered = false;
    logger.info('[ToolHandlers] IPC handlers removed');
  }
}

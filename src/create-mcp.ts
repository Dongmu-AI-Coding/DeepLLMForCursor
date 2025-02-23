import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  CallToolResult,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validate required environment variables
const REQUIRED_ENV_VARS = ['DEEPSEEK_R1_API_KEY', 'DEEPSEEK_R1_API_URL', 'DEEPSEEK_R1_MODEL'];
for (const envVar of REQUIRED_ENV_VARS) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// DeepSeek R1 API configuration
const deepseekConfig = {
  apiKey: process.env.DEEPSEEK_R1_API_KEY as string,
  apiUrl: process.env.DEEPSEEK_R1_API_URL as string,
  model: process.env.DEEPSEEK_R1_MODEL as string,
};

// Implement DeepSeek R1 thinking function
async function deepseekR1Thinking(query: string, filePaths?: string[]): Promise<string> {
  try {
    // Prepare context
    let context = query;

    // Call DeepSeek API
    const response = await axios.post(
      deepseekConfig.apiUrl,
      {
        model: deepseekConfig.model,
        messages: [
          {
            role: 'user',
            content: context,
          },
        ],
      },
      {
        headers: {
          'Authorization': `Bearer ${deepseekConfig.apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Error calling DeepSeek API:', error);
    throw new Error('Failed to process thinking request');
  }
}

// Define the tools once to avoid repetition
const TOOLS: Tool[] = [
  {
    name: 'deepseek-r1-thinking',
    description: 'use deepseek-r1 to think about the problem and return the thinking process. For each question, first use this tool to think through the problem, then provide an answer based on the thinking process.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'the query to think about',
        }
      },
      required: ['query'],
    },
  }
];

async function handleToolCall(name: string, args: any, server: Server): Promise<CallToolResult> {
  switch (name) {
    case 'deepseek-r1-thinking':
      const thinking = await deepseekR1Thinking(args.query, args.filePaths);
      return {
        content: [
          {
            type: 'text',
            text: `Thinking process: ${thinking}`,
          },
        ],
        isError: false,
      };

    default:
      return {
        content: [
          {
            type: 'text',
            text: `Unknown tool: ${name}`,
          },
        ],
        isError: true,
      };
  }
}

export const createMcp = async () => {
  const server = new Server(
    {
      name: 'deepseek-r1',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Setup request handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) =>
    handleToolCall(request.params.name, request.params.arguments ?? {}, server)
  );

  return server;
};

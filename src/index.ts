import { createMcp } from './create-mcp';
import express from 'express';
import morgan from 'morgan';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import net from 'net';
import dotenv from 'dotenv';

// 加载 .env 配置
dotenv.config();

const isPortAvailable = (port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const server = net.createServer()
      .once('error', () => {
        resolve(false);
      })
      .once('listening', () => {
        server.close();
        resolve(true);
      })
      .listen(port);
  });
};

const findAvailablePort = async (startPort: number): Promise<number> => {
  let port = startPort;
  while (!(await isPortAvailable(port))) {
    port++;
  }
  return port;
};

const main = async (port: number) => {
  const availablePort = await findAvailablePort(port);
  const mcp = await createMcp();
  const app = express();
  app.use(morgan('dev'));

  let transport: SSEServerTransport;
  app.get('/sse', async (req, res) => {
    transport = new SSEServerTransport('/messages', res);
    await mcp.connect(transport);
  });

  app.post('/messages', async (req, res) => {
    console.log('New message: ' + req.query.sessionId);
    await transport.handlePostMessage(req, res);
  });

  // Add error handling middleware
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('Error:', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message
    });
  });

  app.listen(availablePort, () => {
    if (availablePort !== port) {
      console.log(`Port ${port} was not available, using port ${availablePort} instead`);
    }
    console.log(`Server is running on port ${availablePort}`);
  });
};

main(Number(process.env.PORT) || 3000);

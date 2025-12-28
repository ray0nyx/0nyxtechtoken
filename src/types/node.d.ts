declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    [key: string]: string | undefined;
  }

  interface Process {
    env: ProcessEnv;
  }

  interface ReadableStream {}
}

declare const process: NodeJS.Process; 
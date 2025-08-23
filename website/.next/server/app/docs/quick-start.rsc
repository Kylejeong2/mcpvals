3:I[9275,[],""]
5:I[1343,[],""]
6:I[231,["231","static/chunks/231-bea070b1ecddfbbc.js","998","static/chunks/app/docs/layout-b24984ce47656698.js"],""]
2:Tab6,import type { Config } from "mcpvals";

export default {
  server: {
    transport: "stdio",
    command: "node",
    args: ["./example/simple-mcp-server.js"],
  },

  // Test individual tools directly
  toolHealthSuites: [
    {
      name: "Calculator Health Tests",
      tests: [
        {
          name: "add",
          args: { a: 5, b: 3 },
          expectedResult: 8,
          maxLatency: 500,
        },
        {
          name: "divide",
          args: { a: 10, b: 0 },
          expectedError: "division by zero",
        },
      ],
    },
  ],

  // Test resources (data and context)
  resourceSuites: [
    {
      name: "Data Access Tests",
      tests: [
        {
          name: "read-config",
          uri: "config://settings",
          expectedMimeType: "application/json",
          maxLatency: 1000,
        },
      ],
    },
  ],

  // Test prompts (templates and workflows)
  promptSuites: [
    {
      name: "Prompt Template Tests",
      tests: [
        {
          name: "user-greeting",
          args: { name: "Alice", role: "admin" },
          expectedContent: ["Welcome", "Alice"],
        },
      ],
    },
  ],

  // Test sampling (LLM requests from server)
  samplingSuites: [
    {
      name: "AI Capability Tests",
      capabilityTests: [
        {
          name: "sampling-supported",
          expectedCapability: true,
        },
      ],
    },
  ],

  // Test OAuth 2.1 authentication flows
  oauth2Suites: [
    {
      name: "OAuth Security Tests",
      authorizationCodeTests: [
        {
          name: "Authorization Code with PKCE",
          flow: "authorization_code",
          server: {
            authorizationEndpoint: "https://auth.example.com/authorize",
            tokenEndpoint: "https://auth.example.com/token",
            supportedGrantTypes: ["authorization_code"],
            supportedScopes: ["read", "write"],
            pkceRequired: true,
          },
          client: {
            clientId: "test-client-id",
            responseType: "code",
            scope: ["read", "write"],
            redirectUri: "https://app.example.com/callback",
            pkce: { enabled: true, codeChallengeMethod: "S256" },
          },
          simulateUserConsent: true,
          expectedResult: "success",
        },
      ],
    },
  ],

  // Test multi-step, LLM-driven workflows
  workflows: [
    {
      name: "Multi-step Calculation",
      steps: [
        {
          user: "Calculate (5 + 3) * 2, then divide by 4",
          expectedState: "4",
        },
      ],
      expectTools: ["add", "multiply", "divide"],
    },
  ],

  // Optional LLM judge
  llmJudge: true,
  openaiKey: process.env.OPENAI_API_KEY,
  passThreshold: 0.8,
} satisfies Config;
4:["slug","quick-start","c"]
0:["mtG3UlcSqFkfpBd0gWDhs",[[["",{"children":["docs",{"children":[["slug","quick-start","c"],{"children":["__PAGE__?{\"slug\":[\"quick-start\"]}",{}]}]}]},"$undefined","$undefined",true],["",{"children":["docs",{"children":[["slug","quick-start","c"],{"children":["__PAGE__",{},[["$L1",["$","article",null,{"className":"prose prose-zinc max-w-none dark:prose-invert","children":[["$","h1","h1-0",{"id":"quick-start","children":["$","a","a-0",{"href":"#quick-start","children":"Quick Start"}]}],"\n",["$","h3","h3-0",{"id":"1-installation","children":["$","a","a-0",{"href":"#1-installation","children":"1. Installation"}]}],"\n",["$","pre","pre-0",{"children":["$","code","code-0",{"className":"language-bash","children":"# Install – pick your favourite package manager\npnpm add -D mcpvals            # dev-dependency is typical\n"}]}],"\n",["$","h3","h3-1",{"id":"2-create-a-config-file","children":["$","a","a-0",{"href":"#2-create-a-config-file","children":"2. Create a config file"}]}],"\n",["$","p","p-0",{"children":["Create a config file (e.g., ",["$","code","code-0",{"children":"mcp-eval.config.ts"}],"):"]}],"\n",["$","pre","pre-1",{"children":["$","code","code-0",{"className":"language-typescript","children":"$2"}]}],"\n",["$","h3","h3-2",{"id":"3-run-evaluation","children":["$","a","a-0",{"href":"#3-run-evaluation","children":"3. Run Evaluation"}]}],"\n",["$","pre","pre-2",{"children":["$","code","code-0",{"className":"language-bash","children":"# Required for workflow execution\nexport ANTHROPIC_API_KEY=\"sk-ant-...\"\n\n# Optional for LLM judge\nexport OPENAI_API_KEY=\"sk-...\"\n\n# Run everything\nnpx mcpvals eval mcp-eval.config.ts\n\n# Run only tool health tests\nnpx mcpvals eval mcp-eval.config.ts --tool-health-only\n\n# Run only resource evaluation tests\nnpx mcpvals eval mcp-eval.config.ts --resources-only\n\n# Run only prompt evaluation tests\nnpx mcpvals eval mcp-eval.config.ts --prompts-only\n\n# Run only sampling evaluation tests\nnpx mcpvals eval mcp-eval.config.ts --sampling-only\n\n# Run only OAuth 2.1 authentication tests\nnpx mcpvals eval mcp-eval.config.ts --oauth-only\n\n# Run with LLM judge and save report\nnpx mcpvals eval mcp-eval.config.ts --llm-judge --reporter json > report.json\n"}]}],"\n",["$","hr","hr-0",{}]]}],null],null],null]},[null,["$","$L3",null,{"parallelRouterKey":"children","segmentPath":["children","docs","children","$4","children"],"error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":["$","$L5",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":"$undefined","notFoundStyles":"$undefined"}]],null]},[[null,["$","div",null,{"className":"flex","children":[["$","aside",null,{"className":"w-64 shrink-0 border-r border-zinc-200/60 dark:border-zinc-800/60 p-4 sticky top-0 h-screen overflow-y-auto","children":[["$","div",null,{"className":"text-lg font-semibold mb-4","children":"MCPVals Docs"}],["$","nav",null,{"className":"space-y-1","children":[["$","$L6","/workspace/website/content/index.md",{"href":"/docs/index","className":"block rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-900","children":"Core Concepts"}],["$","$L6","/workspace/website/content/acknowledgements.md",{"href":"/docs/acknowledgements","className":"block rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-900","children":"Acknowledgements"}],["$","$L6","/workspace/website/content/cli.md",{"href":"/docs/cli","className":"block rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-900","children":"CLI Reference"}],["$","$L6","/workspace/website/content/configuration.md",{"href":"/docs/configuration","className":"block rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-900","children":"Configuration"}],["$","$L6","/workspace/website/content/evaluation.md",{"href":"/docs/evaluation","className":"block rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-900","children":"Evaluation & Metrics"}],["$","$L6","/workspace/website/content/installation.md",{"href":"/docs/installation","className":"block rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-900","children":"Installation & Runtime Requirements"}],["$","$L6","/workspace/website/content/library-api.md",{"href":"/docs/library-api","className":"block rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-900","children":"Library API"}],["$","$L6","/workspace/website/content/quick-start.md",{"href":"/docs/quick-start","className":"block rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-900","children":"Quick Start"}],["$","$L6","/workspace/website/content/roadmap.md",{"href":"/docs/roadmap","className":"block rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-900","children":"Roadmap"}],["$","$L6","/workspace/website/content/vitest.md",{"href":"/docs/vitest","className":"block rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-900","children":"Vitest Integration"}]]}]]}],["$","main",null,{"className":"flex-1 p-6","children":["$","$L3",null,{"parallelRouterKey":"children","segmentPath":["children","docs","children"],"error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":["$","$L5",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":"$undefined","notFoundStyles":"$undefined"}]}]]}]],null],null]},[[[["$","link","0",{"rel":"stylesheet","href":"/_next/static/css/f25260a5bd2b21c3.css","precedence":"next","crossOrigin":"$undefined"}]],["$","html",null,{"lang":"en","children":["$","body",null,{"className":"min-h-screen bg-white text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100","children":["$","$L3",null,{"parallelRouterKey":"children","segmentPath":["children"],"error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":["$","$L5",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":[["$","title",null,{"children":"404: This page could not be found."}],["$","div",null,{"style":{"fontFamily":"system-ui,\"Segoe UI\",Roboto,Helvetica,Arial,sans-serif,\"Apple Color Emoji\",\"Segoe UI Emoji\"","height":"100vh","textAlign":"center","display":"flex","flexDirection":"column","alignItems":"center","justifyContent":"center"},"children":["$","div",null,{"children":[["$","style",null,{"dangerouslySetInnerHTML":{"__html":"body{color:#000;background:#fff;margin:0}.next-error-h1{border-right:1px solid rgba(0,0,0,.3)}@media (prefers-color-scheme:dark){body{color:#fff;background:#000}.next-error-h1{border-right:1px solid rgba(255,255,255,.3)}}"}}],["$","h1",null,{"className":"next-error-h1","style":{"display":"inline-block","margin":"0 20px 0 0","padding":"0 23px 0 0","fontSize":24,"fontWeight":500,"verticalAlign":"top","lineHeight":"49px"},"children":"404"}],["$","div",null,{"style":{"display":"inline-block"},"children":["$","h2",null,{"style":{"fontSize":14,"fontWeight":400,"lineHeight":"49px","margin":0},"children":"This page could not be found."}]}]]}]}]],"notFoundStyles":[]}]}]}]],null],null],["$L7",null]]]]
7:[["$","meta","0",{"name":"viewport","content":"width=device-width, initial-scale=1"}],["$","meta","1",{"charSet":"utf-8"}],["$","title","2",{"children":"MCPVals Docs"}],["$","meta","3",{"name":"description","content":"Documentation for MCPVals"}]]
1:null

# CLI Reference

```
Usage: mcpvals <command>

Commands:
  eval <config>   Evaluate MCP servers using workflows and/or tool health tests
  list <config>   List workflows in a config file
  help [command]  Show help                                [default]

Evaluation options:
  -d, --debug              Verbose logging (child-process stdout/stderr is piped)
  -r, --reporter <fmt>     console | json | junit (JUnit coming soon)
  --llm-judge              Enable LLM judge (requires llmJudge:true + key)
  --tool-health-only       Run only tool health tests, skip others
  --resources-only         Run only resource evaluation tests, skip others
  --prompts-only           Run only prompt evaluation tests, skip others
  --sampling-only          Run only sampling evaluation tests, skip others
  --oauth-only             Run only OAuth 2.1 authentication tests, skip others
  --workflows-only         Run only workflows, skip other test types
```

### 3.1 `eval`

Runs tests specified in the config file. It will run all configured test types (`toolHealthSuites`, `resourceSuites`, `promptSuites`, `samplingSuites`, and `workflows`) by default. Use flags to run only specific types. Exits **0** on success or **1** on any failure – perfect for CI.

### 3.2 `list`

Static inspection – prints workflows without starting the server. Handy when iterating on test coverage.

---

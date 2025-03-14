# ai-chang

An AI-powered tool for automatically generating technical changelogs based on git changes between releases.

## Installation

### Global Installation

```bash
npm install -g ai-chang
```

### Local Project Installation

```bash
# npm
npm install --save-dev ai-chang

# yarn
yarn add -D ai-chang
```

## Usage

### As an npm script

1. Add the script to your `package.json`:

```json
{
  "scripts": {
    "changelog": "ai-chang --from",
    "changelog:detailed": "ai-chang --from $npm_config_from --detailed",
    "changelog:save": "ai-chang --from $npm_config_from --output CHANGELOG.md"
  }
}
```

2. Run with parameters:

```bash
# Basic usage (concise format, from tag to current commit)
npm run changelog --from=v1.0.0

# With specific end tag
npm run changelog --from=v1.0.0 --to=v1.1.0

# Detailed changelog
npm run changelog:detailed --from=v1.0.0

# Save to file
npm run changelog:save --from=v1.0.0
```

### As a CLI command

```bash
# If installed globally (from tag to current commit)
ai-chang --from v1.0.0

# With specific end tag
ai-chang --from v1.0.0 --to v1.1.0

# Using npx
npx ai-chang --from v1.0.0

# Save to file
ai-chang --from v1.0.0 --output CHANGELOG.md
```

## Parameters

- `--from, -f`: Starting tag or commit (required)
- `--to, -t`: Ending tag or commit (optional, defaults to current commit)
- `--output, -o`: Output file path (optional)
- `--detailed, -d`: Generate detailed changelog with technical information (optional)
- `--api-key, -k`: OpenAI API key (can also be set via OPENAI_API_KEY environment variable)

## OpenAI API Key Setup

There are several ways to provide the API key (in order of priority):

1. Via command line parameter:

```bash
ai-chang --from v1.0.0 --to v1.1.0 --api-key your-api-key
```

2. Via environment variable in CI/CD (e.g., GitHub Actions):

```yaml
env:
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

3. Via local `.env` file:

```bash
# .env
OPENAI_API_KEY=your-api-key
```

## Usage Examples

### Generating changelog between latest tags

```bash
# Get previous tag
PREV_TAG=$(git describe --tags --abbrev=0 HEAD^)
CURRENT_TAG=$(git describe --tags --abbrev=0)

# Generate changelog
npm run changelog --from=$PREV_TAG --to=$CURRENT_TAG
```

### Using with GitHub Actions

```yaml
name: Generate Changelog
on:
  push:
    tags:
      - 'v*'

jobs:
  changelog:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0 # Important to fetch complete git history

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Generate Changelog
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: |
          # Get previous tag
          PREV_TAG=$(git describe --tags --abbrev=0 HEAD^)
          npx ai-chang --from $PREV_TAG --to ${{ github.ref_name }} --output CHANGELOG.md
```

## Requirements

- Node.js >= 18.0.0
- Git installed in the system
- OpenAI API key

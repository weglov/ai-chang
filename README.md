# Release Notes AI

An AI-powered tool for automatically generating technical changelogs based on git changes between releases.

## Installation

### Global Installation

```bash
npm install -g @viktorshcheglov/release-notes-ai
```

### Local Project Installation

```bash
# npm
npm install --save-dev @viktorshcheglov/release-notes-ai

# yarn
yarn add -D @viktorshcheglov/release-notes-ai
```

## Usage

### As an npm script

1. Add the script to your `package.json`:

```json
{
  "scripts": {
    "changelog": "release-notes-ai --from",
    "changelog:detailed": "release-notes-ai --from $npm_config_from --to $npm_config_to --detailed",
    "changelog:save": "release-notes-ai --from $npm_config_from --to $npm_config_to --output CHANGELOG.md"
  }
}
```

2. Run with parameters:

```bash
# Basic usage (concise format)
npm run changelog --from=v1.0.0 --to=v1.1.0

# Detailed changelog
npm run changelog:detailed --from=v1.0.0 --to=v1.1.0

# Save to file
npm run changelog:save --from=v1.0.0 --to=v1.1.0
```

### As a CLI command

```bash
# If installed globally
release-notes-ai --from v1.0.0 --to v1.1.0

# Using npx
npx @viktorshcheglov/release-notes-ai --from v1.0.0 --to v1.1.0

# Save to file
release-notes-ai --from v1.0.0 --to v1.1.0 --output CHANGELOG.md
```

## Parameters

- `--from, -f`: Starting tag or commit (required)
- `--to, -t`: Ending tag or commit (required)
- `--output, -o`: Output file path (optional)
- `--detailed, -d`: Generate detailed changelog with technical information (optional)
- `--api-key, -k`: OpenAI API key (can also be set via OPENAI_API_KEY environment variable)

## OpenAI API Key Setup

There are several ways to provide the API key (in order of priority):

1. Via command line parameter:

```bash
release-notes-ai --from v1.0.0 --to v1.1.0 --api-key your-api-key
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
          npx @viktorshcheglov/release-notes-ai --from $PREV_TAG --to ${{ github.ref_name }} --output CHANGELOG.md
```

## Requirements

- Node.js >= 18.0.0
- Git installed in the system
- OpenAI API key

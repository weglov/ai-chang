#!/usr/bin/env node

// Disable warning about deprecated punycode module
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.name === 'DeprecationWarning' && 
      warning.message.includes('The `punycode` module is deprecated')) {
    return;
  }
  console.warn(warning);
});

import { Command } from 'commander';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { execSync } from 'child_process';
import fs from 'fs';

// Load environment variables
dotenv.config();

let openai: OpenAI;

interface FileChange {
  file: string;
  diff: string;
}

// Function to get API key
function getApiKey(options: { apiKey?: string }): string {
  // Priority:
  // 1. Command line parameter
  // 2. OPENAI_API_KEY from GitHub Actions
  // 3. OPENAI_API_KEY from .env or system environment variables
  if (options.apiKey) {
    return options.apiKey;
  }

  // Check if running in GitHub Actions
  if (process.env.GITHUB_ACTIONS === 'true') {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not found in GitHub Actions secrets. Please add it to your repository secrets.');
    }
    return process.env.OPENAI_API_KEY;
  }

  // Check local environment variables
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not found. Please provide it via --api-key option or set it in .env file');
  }

  return process.env.OPENAI_API_KEY;
}

async function getFileChanges(fromTag: string, toTag: string): Promise<FileChange[]> {
  // Get list of changed files
  const changedFiles = execSync(`git diff --name-only ${fromTag}..${toTag}`).toString().split('\n').filter(Boolean);
  const changes: FileChange[] = [];

  for (const file of changedFiles) {
    try {
      // Get diff for each file with context
      const fileDiff = execSync(`git diff ${fromTag}..${toTag} -- "${file}"`).toString();
      if (fileDiff) {
        changes.push({
          file,
          diff: fileDiff
        });
      }
    } catch (error) {
      console.warn(`Failed to get diff for file ${file}:`, error instanceof Error ? error.message : String(error));
    }
  }

  return changes;
}

function summarizeChanges(changes: FileChange[]): string {
  let summary = '';
  
  for (const change of changes) {
    // Add only first 50 lines of diff for each file to avoid token limits
    const diffLines = change.diff.split('\n').slice(0, 50);
    summary += `\nFile: ${change.file}\n`;
    summary += `${diffLines.join('\n')}\n`;
    
    if (change.diff.split('\n').length > 50) {
      summary += '\n... (diff truncated for brevity)\n';
    }
  }

  return summary;
}

async function generateChangelog(fromTag: string, toTag: string, detailed = false): Promise<string> {
  try {
    // Get basic information
    const fileStatus = execSync(`git diff ${fromTag}..${toTag} --name-status`).toString();
    const commits = execSync(`git log ${fromTag}..${toTag} --pretty=format:"%h - %s"`).toString();
    
    // Get detailed code changes
    const changes = await getFileChanges(fromTag, toTag);
    const codeChanges = summarizeChanges(changes);

    // Form prompt for AI
    const prompt = detailed ? 
      `Please analyze these git changes and generate a detailed technical changelog in markdown format.` :
      `Please analyze these git changes and generate a concise, high-level changelog in markdown format. Focus only on the most important changes and keep each entry brief (1-2 lines max).`;

    const prompt_details = `
    Git diff summary (files changed):
    ${fileStatus}
    
    ${detailed ? `Detailed code changes:
    ${codeChanges}` : ''}
    
    Commits:
    ${commits}
    
    Guidelines:
    - Focus on user-facing changes and significant technical updates
    - Use clear, non-technical language where possible
    - Group similar changes together
    - ${detailed ? 'Provide technical details and impact' : 'Keep it brief and high-level'}
    - Use bullet points for better readability`;

    // Generate changelog using AI
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: detailed ? 
            "You are a technical writer creating detailed changelogs." :
            "You are a technical writer creating concise, user-friendly release notes. Keep the output brief and focused on key changes."
        },
        {
          role: "user",
          content: prompt + prompt_details
        }
      ],
      temperature: 0.7,
    });

    if (!completion.choices[0].message.content) {
      throw new Error('No content received from OpenAI');
    }

    return completion.choices[0].message.content;
  } catch (error) {
    console.error('Error generating changelog:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

const program = new Command();

program
  .name('release-notes-ai')
  .description('Generate AI-powered release notes from git tags')
  .version('1.0.0')
  .requiredOption('-f, --from <tag>', 'Starting tag or commit')
  .requiredOption('-t, --to <tag>', 'Ending tag or commit')
  .option('-o, --output <file>', 'Output file (optional)')
  .option('-k, --api-key <key>', 'OpenAI API Key (can also be set via OPENAI_API_KEY environment variable)')
  .option('-d, --detailed', 'Generate detailed changelog with technical information')
  .action(async (options) => {
    try {
      // Initialize OpenAI with key
      openai = new OpenAI({
        apiKey: getApiKey(options)
      });

      const changelog = await generateChangelog(options.from, options.to, options.detailed);
      
      if (options.output) {
        fs.writeFileSync(options.output, changelog);
        console.log(`Changelog has been written to ${options.output}`);
      } else {
        console.log(changelog);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program.parse(); 
#!/usr/bin/env node

import { Command } from 'commander';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { execSync } from 'child_process';
import fs from 'fs';

// Загружаем переменные окружения
dotenv.config();

let openai: OpenAI;

interface FileChange {
  file: string;
  diff: string;
}

// Функция для получения API ключа
function getApiKey(options: { apiKey?: string }): string {
  // Приоритет:
  // 1. Ключ из параметров командной строки
  // 2. OPENAI_API_KEY из GitHub Actions
  // 3. OPENAI_API_KEY из .env или системных переменных окружения
  if (options.apiKey) {
    return options.apiKey;
  }

  // Проверяем, запущен ли скрипт в GitHub Actions
  if (process.env.GITHUB_ACTIONS === 'true') {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not found in GitHub Actions secrets. Please add it to your repository secrets.');
    }
    return process.env.OPENAI_API_KEY;
  }

  // Проверяем локальные переменные окружения
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not found. Please provide it via --api-key option or set it in .env file');
  }

  return process.env.OPENAI_API_KEY;
}

async function getFileChanges(fromTag: string, toTag: string): Promise<FileChange[]> {
  // Получаем список измененных файлов
  const changedFiles = execSync(`git diff --name-only ${fromTag}..${toTag}`).toString().split('\n').filter(Boolean);
  const changes: FileChange[] = [];

  for (const file of changedFiles) {
    try {
      // Получаем diff для каждого файла с контекстом
      const fileDiff = execSync(`git diff ${fromTag}..${toTag} -- "${file}"`).toString();
      if (fileDiff) {
        changes.push({
          file,
          diff: fileDiff
        });
      }
    } catch (error) {
      console.warn(`Не удалось получить diff для файла ${file}:`, error instanceof Error ? error.message : String(error));
    }
  }

  return changes;
}

function summarizeChanges(changes: FileChange[]): string {
  let summary = '';
  
  for (const change of changes) {
    // Добавляем только первые 50 строк диффа для каждого файла, чтобы не превышать лимиты токенов
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
    // Получаем базовую информацию
    const fileStatus = execSync(`git diff ${fromTag}..${toTag} --name-status`).toString();
    const commits = execSync(`git log ${fromTag}..${toTag} --pretty=format:"%h - %s"`).toString();
    
    // Получаем детальные изменения в коде
    const changes = await getFileChanges(fromTag, toTag);
    const codeChanges = summarizeChanges(changes);

    // Формируем промпт для AI
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

    // Генерируем changelog с помощью AI
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
      // Инициализируем OpenAI с ключом
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